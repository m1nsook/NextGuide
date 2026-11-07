import { randomUUID, createHmac, timingSafeEqual } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync, lstatSync, appendFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { verifyReleaseSubmission, validateSubmission } from "./verify-release.mjs"
import { publishRemoteApprovedRelease, readRegistry } from "./lib.mjs"

const COOKIE = "ng_registry_session"
const WINDOW = 3600_000
const ATTEMPTS = new Map()
const REVIEWING = new Set()
const UUID = /^[0-9a-f-]{36}$/
const escape = x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c])
function equal(a,b) {
  const x = Buffer.from(String(a||"")), y = Buffer.from(String(b||""))
  return x.length === y.length && timingSafeEqual(x,y)
}
function sign(secret,value) { return createHmac("sha256",secret).update(value).digest("base64url") }
function json(res,status,obj,extra={}) {
  const bytes=Buffer.from(JSON.stringify(obj)+"\n")
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Content-Length":String(bytes.length),
    "Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...extra})
  res.end(bytes)
}
function html(res,status,body,headers={}) {
  const content=Buffer.from(body)
  res.writeHead(status,{"Content-Type":"text/html; charset=utf-8","Content-Length":String(content.length),
    "Cache-Control":"no-store","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer",
    "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    ...headers})
  res.end(content)
}
async function body(req) {
  const type=String(req.headers["content-type"]||"").split(";")[0].toLowerCase()
  if (type!=="application/json"&&type!=="application/x-www-form-urlencoded") throw Error("Unsupported content type")
  let size=0
  const parts=[]
  for await (const part of req) {
    size+=part.length
    if(size>8192) throw Error("Request body too large")
    parts.push(part)
  }
  const string=Buffer.concat(parts).toString("utf8")
  if (type==="application/json") return JSON.parse(string)
  return Object.fromEntries(new URLSearchParams(string))
}
function directory(opts) { return join(resolve(opts.dataDir),"submissions") }
function pathFor(opts,id) {
  if(!UUID.test(id)) throw Error("Invalid submission ID")
  return join(directory(opts),id+".json")
}
function all(opts) {
  const dir=directory(opts)
  if(!existsSync(dir)) return []
  return readdirSync(dir).filter(n=>UUID.test(n.slice(0,-5))&&n.endsWith(".json"))
    .map(n=>{try { const p=join(dir,n);if(!lstatSync(p).isFile())return null;return JSON.parse(readFileSync(p,"utf8")) }catch{return null}})
    .filter(Boolean).sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt))
}
function load(opts,id) { return JSON.parse(readFileSync(pathFor(opts,id),"utf8")) }
function save(opts,r,create=false) {
  mkdirSync(directory(opts),{recursive:true,mode:0o700})
  const file=pathFor(opts,r.id)
  if(create&&existsSync(file)) throw Error("Submission already exists")
  const tmp=file+"."+randomUUID()+".tmp"
  writeFileSync(tmp,JSON.stringify(r,null,2)+"\n",{flag:"wx",mode:0o600})
  renameSync(tmp,file)
}
function audit(opts,action,r) {
  mkdirSync(opts.dataDir,{recursive:true,mode:0o700})
  appendFileSync(join(opts.dataDir,"review-audit.jsonl"),
    JSON.stringify({at:new Date().toISOString(),action,submission:r.id,id:r.manifest.id,
      version:r.manifest.version,source:r.repository,commit:r.commit})+"\n",{mode:0o600})
}
function clientIp(req) {
  const remote=req.socket.remoteAddress||"unknown"
  if (["127.0.0.1","::1","::ffff:127.0.0.1"].includes(remote)) {
    const real=String(req.headers["x-real-ip"]||"")
    if (/^[0-9a-f.:]{3,45}$/i.test(real)) return real
  }
  return remote
}
function limit(key) {
  const now=Date.now()
  const a=(ATTEMPTS.get(key)||[]).filter(t=>now-t<WINDOW)
  if(a.length>=5) {ATTEMPTS.set(key,a);return true}
  a.push(now);ATTEMPTS.set(key,a)
  if(ATTEMPTS.size>10000)ATTEMPTS.clear()
  return false
}
async function notify(opts,event,r) {
  if(!opts.webhook)return
  try {
    const url=new URL(opts.webhook)
    if(url.protocol!=="https:"||url.hostname!=="discord.com"||
      !/^\/api\/webhooks\/[0-9]+\/[a-zA-Z0-9._-]+$/.test(url.pathname))throw Error("Invalid Discord webhook configuration")
    const title=event==="submission"?(r.isUpdate?"Add-on update submitted":"New add-on submitted"):
      event==="approved"?"Add-on approved":"Add-on rejected"
    const payload={allowed_mentions:{parse:[]},embeds:[{title,
      description:r.manifest.name+" ("+r.manifest.id+")",
      fields:[{name:"Version",value:r.manifest.version},{name:"Status",value:r.status},
        {name:"Repository",value:r.repository},{name:"Request",value:r.id}],
      timestamp:new Date().toISOString()}]}
    const resp=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)})
    if(!resp.ok)console.error("[nextguide-registry] Discord status",resp.status)
  }catch(err){console.error("[nextguide-registry] Discord notification failed:",err.message)}
}
function token(opts,session) {return sign(opts.sessionSecret,"csrf:"+session.nonce)}
function currentSession(req,opts) {
  const v=String(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1)
  if(!v||v.length>240)return null
  const p=v.split(".")
  if(p.length!==3||!/^[0-9]{13}$/.test(p[0])||!/^[0-9a-f]{32}$/.test(p[1])||
    +p[0]<Date.now()||+p[0]>Date.now()+WINDOW+10000||
    !equal(p[2],sign(opts.sessionSecret,p[0]+"."+p[1])))return null
  return {nonce:p[1]}
}
function cookie(opts) {
  const time=String(Date.now()+WINDOW)
  const nonce=randomUUID().replace(/-/g,"")
  const value=time+"."+nonce
  return COOKIE+"="+value+"."+sign(opts.sessionSecret,value)+"; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=3600"
}
function origin(req,opts) { return req.headers.origin===opts.origin && req.headers["sec-fetch-site"]!=="cross-site" }
function layout(title,body) {
  const css=":root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#10151f;color:#e8edf9}" +
  "*{box-sizing:border-box}body{margin:0}header{padding:24px;border-bottom:1px solid #35405a}main{max-width:1100px;margin:35px auto;padding:20px}" +
  ".card{border:1px solid #35405a;border-radius:12px;background:#192234;padding:22px;margin:14px 0}p,small{color:#b9c4d8}" +
  "h1{font-size:29px;letter-spacing:-.02em}a{color:#9cafff}input{border:1px solid #53617b;border-radius:8px;background:#10151f;color:white;padding:12px;width:100%}" +
  "button{background:#8599fc;color:#080e23;border:0;border-radius:7px;padding:10px 14px;font-weight:700;cursor:pointer}" +
  "button.reject{background:#ffbf84}table{border-collapse:collapse;width:100%}th,td{text-align:left;border-bottom:1px solid #364157;padding:13px 8px}" +
  "form.inline{display:inline-block;margin-right:8px}form.inline button{font-size:12px}.badge{border:1px solid #65718a;border-radius:5px;padding:3px 7px}" +
  ".row{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}code{overflow-wrap:anywhere}"
  return "<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'><title>"+
    escape(title)+" · NextGuide Registry</title><style>"+css+"</style></head><body><header><strong>NextGuide Registry</strong> · Private review</header><main>"+body+"</main></body></html>"
}
function loginPage() {return layout("Sign in","<section class='card' style='max-width:460px;margin:auto'><h1>Registry owner login</h1>"+
  "<p>Enter your private registry admin secret.</p><form method='post' action='/admin/login'>"+
  "<label for='secret'>Administrator secret</label><p><input id='secret' type='password' name='secret' required minlength='32'></p>"+
  "<button>Sign in</button></form></section>")}
function dashboard(opts,user) {
  const rows=all(opts)
  const t=token(opts,user)
  const table=rows.map(r=>{
    const base="<td><strong>"+escape(r.manifest.name)+"</strong><p><code>"+escape(r.manifest.id)+"</code></p></td>"+
      "<td>"+escape(r.manifest.version)+"</td><td><span class='badge'>"+escape(r.status)+"</span></td>"+
      "<td><a target='_blank' rel='noopener noreferrer' href='"+escape(r.repository)+"'>Source</a></td>"
    const forms=r.status==="pending"?
      ["approve","reject"].map(a=>"<form class='inline' method='post' action='/admin/review/"+r.id+"/"+a+"'>"+
        "<input type='hidden' name='csrf' value='"+t+"'><button class='"+(a==="reject"?"reject":"")+"'>"+a+"</button></form>").join("") :
      "<small>"+escape(r.reviewedAt||"")+"</small>"
    return "<tr>"+base+"<td>"+forms+"</td></tr>"
  }).join("")
  const stats=["pending","approved","rejected"].map(s=>"<span class='badge'>"+s+": "+rows.filter(r=>r.status===s).length+"</span>").join(" ")
  return layout("Review queue","<div class='row'><h1>Pending add-on publications</h1><form method='post' action='/admin/logout'>"+
    "<input type='hidden' name='csrf' value='"+t+"'><button class='reject'>Logout</button></form></div>"+
    "<p>Releases are independently checked on submission and again before approval. Approvals update the signed registry.</p><p>"+stats+"</p>"+
    "<section class='card'><table><thead><tr><th>Add-on</th><th>Version</th><th>Status</th><th>Source</th><th>Action</th></tr></thead><tbody>"+
    table+"</tbody></table>"+(rows.length?"":"<p>No submissions yet.</p>")+"</section>")
}
export async function handleRegistryWrites(req,res,opts) {
  let url
  try{url=new URL(req.url,"http://127.0.0.1")}catch{return false}
  const path=url.pathname,method=req.method||"GET"
  if(path==="/v1/submissions") {
    if(method!=="POST"){json(res,405,{error:"Use POST"},{Allow:"POST"});return true}
    if(!opts.privateKey){json(res,503,{error:"Publishing disabled"});return true}
    if(limit("publish:"+clientIp(req))){json(res,429,{error:"Submission rate limit"},{ "Retry-After":"3600" });return true}
    try {
      const submitted=validateSubmission(await body(req))
      const verified=await (opts.verify||verifyReleaseSubmission)(submitted)
      const submissions=all(opts)
      if(submissions.some(r=>r.repository.toLowerCase()===verified.repository.toLowerCase()&&r.tag===verified.tag&&r.status!=="rejected")){
        json(res,409,{error:"Release already submitted"});return true
      }
      const index=readRegistry(opts.dataDir,opts.publicKey).payload
      if(index.releases.some(r=>r.manifest.id===verified.manifest.id&&r.manifest.version===verified.manifest.version)){
        json(res,409,{error:"Version already published"});return true
      }
      const r={...verified,id:randomUUID(),status:"pending",submittedAt:new Date().toISOString(),
        reviewedAt:null,isUpdate:index.releases.some(x=>x.manifest.id===verified.manifest.id)}
      save(opts,r,true);audit(opts,"submit",r)
      await notify(opts,"submission",r)
      json(res,202,{id:r.id,status:"pending",message:"Verified release queued for owner approval"})
    } catch(error) {
      console.error("[nextguide-registry] Submission validation failed:",error.message)
      json(res,422,{error:"Submission rejected: "+error.message})
    }
    return true
  }
  if(path==="/admin"||path.startsWith("/admin/")) {
    if(!opts.adminSecret||opts.adminSecret.length<32||!opts.sessionSecret||opts.sessionSecret.length<32||
      !opts.privateKey||!opts.origin){json(res,503,{error:"Admin not configured"});return true}
    if(path==="/admin/login"&&method==="POST"){
      if(!origin(req,opts)){json(res,403,{error:"Invalid Origin"});return true}
      if(limit("login:"+clientIp(req))){json(res,429,{error:"Too many attempts"});return true}
      try {
        const b=await body(req)
        if(!equal(b.secret,opts.adminSecret)){html(res,401,loginPage());return true}
        res.writeHead(303,{"Location":"/admin","Set-Cookie":cookie(opts),"Cache-Control":"no-store"});res.end()
      }catch {json(res,400,{error:"Invalid login request"})}
      return true
    }
    const user=currentSession(req,opts)
    if(!user){
      if(method==="GET"&&(path==="/admin"||path==="/admin/login"))html(res,200,loginPage())
      else json(res,401,{error:"Owner login required"})
      return true
    }
    if(method==="GET"&&(path==="/admin"||path==="/admin/login")){html(res,200,dashboard(opts,user));return true}
    if(method==="POST"&&path==="/admin/logout") {
      if(!origin(req,opts)){json(res,403,{error:"Invalid Origin"});return true}
      const b=await body(req)
      if(!equal(b.csrf,token(opts,user))){json(res,403,{error:"Invalid CSRF"});return true}
      res.writeHead(303,{"Location":"/admin","Set-Cookie":COOKIE+"=; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=0"});res.end()
      return true
    }
    const action=/^\/admin\/review\/([0-9a-f-]{36})\/(approve|reject)$/.exec(path)
    if(method==="POST"&&action) {
      if(!origin(req,opts)){json(res,403,{error:"Invalid Origin"});return true}
      let input
      try{input=await body(req)}catch{json(res,400,{error:"Invalid request"});return true}
      if(!equal(input.csrf,token(opts,user))){json(res,403,{error:"Invalid CSRF"});return true}
      const [,id,decision]=action
      if(REVIEWING.has(id)){json(res,409,{error:"Concurrent review"});return true}
      REVIEWING.add(id)
      try {
        const r=load(opts,id)
        if(r.status!=="pending")throw Error("Already reviewed")
        if(decision==="approve") {
          const verified=await (opts.verify||verifyReleaseSubmission)({ repository:r.repository, tag:r.tag,
            commit:r.commit, assetUrl:r.assetUrl, sha256:r.digest })
          if(verified.digest!==r.digest||verified.commit!==r.commit||
            verified.manifest.id!==r.manifest.id||verified.manifest.version!==r.manifest.version)throw Error("Release has changed since submission")
          publishRemoteApprovedRelease(opts.dataDir,opts.privateKey,verified,"registry-owner")
          r.status="approved"
        }else r.status="rejected"
        r.reviewedAt=new Date().toISOString()
        save(opts,r);audit(opts,decision,r);await notify(opts,r.status,r)
        res.writeHead(303,{"Location":"/admin","Cache-Control":"no-store"});res.end()
      }catch(error){console.error("[nextguide-registry] Review error:",error.message);json(res,409,{error:error.message})}
      finally{REVIEWING.delete(id)}
      return true
    }
    json(res,404,{error:"Not found"});return true
  }
  return false
}
