import test from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import {
  isPublicExtensionIPv4, createRestrictedExtensionHttpsAdapter
} from "../lib/extension-network.mjs"
import { createExtensionBroker } from "../dist/extensions/runtime.js"

const publicDns = async () => [{address:"93.184.216.34",family:4}]
const digest = "b".repeat(64)
const manifest = {
  schemaVersion:2,id:"acme.network-test",name:"Network test",version:"1.0.0",
  category:"integration",compatibility:{mode:"account",nextguide:">=1.0.0 <2.0.0"},
  permissions:["network.fetch"],entrypoints:{server:"dist/server.mjs"}
}

function mockHttps({status=200, contentType="application/json", body='{"ok":true}', size=null}={}) {
  const calls=[]
  const transport=(options,respond)=>{
    const req = new EventEmitter()
    req.end = requestBody => {
      calls.push({options,requestBody})
      queueMicrotask(()=>{
        const response = new PassThrough()
        response.statusCode = status
        response.headers = {
          "content-type":contentType,
          ...(size===null?{}:{"content-length":String(size)}),
        }
        respond(response)
        response.end(body)
      })
    }
    return req
  }
  return {transport,calls}
}

test("reserved, private, loopback, carrier NAT and public DNS addresses",()=>{
  for(const address of [
    "0.0.0.0","10.0.0.1","100.64.0.1","127.0.0.1",
    "169.254.169.254","172.16.0.1","172.31.255.255",
    "192.0.0.1","192.0.2.1","192.88.99.1","192.168.1.1",
    "198.18.0.1","198.51.100.1","203.0.113.1",
    "224.0.0.1","255.255.255.255","::1",
    "::ffff:127.0.0.1","not-an-ip"
  ]) assert.equal(isPublicExtensionIPv4(address),false,address)
  for(const address of ["1.1.1.1","8.8.8.8","93.184.216.34","200.1.2.3"]){
    assert.equal(isPublicExtensionIPv4(address),true,address)
  }
})

test("adapter requires exact, valid host allowlists",()=>{
  for(const host of ["localhost","internal.local","API.EXAMPLE.ORG","127.0.0.1",
    "*.example.org","api.example.org:8443","api.example.org/path"]){
    assert.throws(()=>createRestrictedExtensionHttpsAdapter({allowedHosts:[host]}),/allowlist/)
  }
  assert.throws(()=>createRestrictedExtensionHttpsAdapter({timeoutMs:90000}),/timeout/)
  assert.throws(()=>createRestrictedExtensionHttpsAdapter({maxResponseBytes:1000000}),/size/)
})

test("pinned DNS and verified TLS endpoint are used for approved requests",async()=>{
  const network = mockHttps()
  const adapter = createRestrictedExtensionHttpsAdapter({
    allowedHosts:["api.example.org"],resolver:publicDns,transport:network.transport,
  })
  const result = await adapter.request("acme.network-test",{
    url:"https://api.example.org/v1/data?limit=2",method:"GET"
  })
  assert.equal(result.ok,true)
  assert.equal(network.calls.length,1)
  const opts = network.calls[0].options
  assert.equal(opts.hostname,"api.example.org")
  assert.equal(opts.servername,"api.example.org")
  assert.equal(opts.path,"/v1/data?limit=2")
  assert.equal(opts.port,443)
  assert.equal(opts.rejectUnauthorized,true)
  assert.equal(opts.agent,false)
  assert.equal(opts.autoSelectFamily,false)
  assert.equal(opts.headers.accept,"application/json")
  let pinned
  opts.lookup("api.example.org",{},(_err,ip,family)=>{pinned={ip,family}})
  assert.deepEqual(pinned,{ip:"93.184.216.34",family:4})
})

test("mixed DNS results fail closed instead of selecting public fallback", async()=>{
  let transportCalls=0
  for(const answers of [
    [{address:"10.0.0.3",family:4}],
    [{address:"93.184.216.34",family:4},{address:"127.0.0.1",family:4}],
    [{address:"::1",family:6}],
    [],
  ]){
    const adapter=createRestrictedExtensionHttpsAdapter({
      allowedHosts:["api.example.org"],resolver:async()=>answers,
      transport(){transportCalls++;throw Error("must not reach network")}
    })
    await assert.rejects(adapter.request("acme.network-test",{
      url:"https://api.example.org/",method:"GET"
    }),/unsafe or invalid/)
  }
  assert.equal(transportCalls,0)
})

test("unsupported URLs cannot reach DNS or network transport",async()=>{
  let dnsCalls=0
  const adapter=createRestrictedExtensionHttpsAdapter({
    allowedHosts:["api.example.org"],resolver:async()=>{dnsCalls++;return publicDns()}
  })
  for(const url of [
    "http://api.example.org/","https://api.example.org:8443/",
    "https://other.example.org/","https://api.example.org.evil.com/",
    "https://alice:password@api.example.org/","https://127.0.0.1/",
    "https://api.example.org/#fragment","file:///etc/passwd"
  ]){
    await assert.rejects(adapter.request("acme.network-test",{url,method:"GET"}),/not on an approved|Invalid/)
  }
  assert.equal(dnsCalls,0)
})

test("redirects, HTML and oversized responses are rejected without following",async()=>{
  for(const config of [
    {status:302},
    {status:500},
    {contentType:"text/html"},
    {body:"x".repeat(300),size:300},
    {body:"x".repeat(300)}
  ]){
    const network=mockHttps(config)
    const adapter=createRestrictedExtensionHttpsAdapter({
      allowedHosts:["api.example.org"],resolver:publicDns,
      transport:network.transport,maxResponseBytes:128
    })
    await assert.rejects(adapter.request("acme.network-test",{
      url:"https://api.example.org/",method:"GET"
    }),/response/)
    assert.equal(network.calls.length,1)
  }
})

test("POST sends only JSON to approved host, with no caller-controlled headers",async()=>{
  const net=mockHttps()
  const adapter=createRestrictedExtensionHttpsAdapter({
    allowedHosts:["api.example.org"],resolver:publicDns,transport:net.transport
  })
  assert.equal((await adapter.request("acme.network-test",{
    url:"https://api.example.org/submit",method:"POST",body:{count:2}
  })).ok,true)
  assert.equal(net.calls[0].requestBody.toString(), '{"count":2}')
  assert.equal(net.calls[0].options.headers["content-type"],"application/json")
  assert.equal(Object.hasOwn(net.calls[0].options.headers,"authorization"),false)
  await assert.rejects(adapter.request("acme.network-test",{
    url:"https://api.example.org/",method:"DELETE"
  }),/Only GET and POST/)
})

test("abort before DNS completes does not open the network socket",async()=>{
  let opened=0
  const controller=new AbortController()
  const adapter=createRestrictedExtensionHttpsAdapter({
    allowedHosts:["api.example.org"],
    resolver:()=>new Promise(()=>{}),
    transport(){opened++;throw Error("must not open")},
  })
  const result=adapter.request("acme.network-test",{
    url:"https://api.example.org/",method:"GET"
  },controller.signal)
  controller.abort()
  await assert.rejects(result,/aborted or timed out/)
  assert.equal(opened,0)
})

test("extension broker grants exact host permission before restricted adapter",async()=>{
  const net=mockHttps()
  const adapter=createRestrictedExtensionHttpsAdapter({
    allowedHosts:["api.example.org"],resolver:publicDns,transport:net.transport
  })
  const broker=createExtensionBroker({
    authorize:()=>({permissions:["network.fetch"],networkHosts:["api.example.org"]}),
    network:adapter
  })
  const session=await broker.openSession(manifest,digest)
  const allowed=await session.handle({id:"1",method:"network.request",params:{
    url:"https://api.example.org/hello",method:"GET"
  }})
  assert.equal(allowed.ok,true)
  const denied=await session.handle({id:"2",method:"network.request",params:{
    url:"https://other.example.org/",method:"GET"
  }})
  assert.equal(denied.ok,false)
  assert.equal(denied.error.code,"NETWORK_DENIED")
  assert.equal(net.calls.length,1)
  session.close()
})
