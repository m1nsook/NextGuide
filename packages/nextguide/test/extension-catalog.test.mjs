import test from "node:test"
import assert from "node:assert/strict"
import { createHash, createPublicKey, generateKeyPairSync, sign } from "node:crypto"
import {
  createVerifiedRegistryClient, verifySignedRegistryEnvelope, listVerifiedAddons
} from "../lib/extension-catalog.mjs"

const keys = generateKeyPairSync("ed25519")
const otherKeys = generateKeyPairSync("ed25519")
const publicKeyPem = keys.publicKey.export({type:"spki",format:"pem"})
const otherKeyPem = otherKeys.publicKey.export({type:"spki",format:"pem"})
const keyId = createHash("sha256")
  .update(createPublicKey(publicKeyPem).export({type:"spki",format:"der"})).digest("hex").slice(0,24)

function release(version, status = "active") {
  const manifest = {
    schemaVersion:1, id:"acme.hello-world", name:"Hello World", version,
    repository:"https://github.com/acme/hello-world", category:"content",
    compatibility:{mode:"account",nextguide:">=1.0.0 <2.0.0"},permissions:[]
  }
  return {manifest,tag:"v"+version,commit:"a".repeat(40),digest:"b".repeat(64),
    assetUrl:"https://github.com/acme/hello-world/releases/download/v"+version+
      "/nextguide-addon-"+version+".tgz",
    size: 1024, reviewer:"registry-owner", approvedAt:new Date().toISOString(),status}
}
function envelope(releases) {
  const body=Buffer.from(JSON.stringify({
    schemaVersion:1,updatedAt:new Date().toISOString(),releases
  }))
  return {schemaVersion:1,algorithm:"Ed25519",keyId,body:body.toString("base64url"),
    signature:sign(null,body,keys.privateKey).toString("base64url")}
}
const raw = x => JSON.parse(JSON.stringify(x))

test("valid Ed25519 index yields only active newest versions", () => {
  const signed=envelope([
    release("1.0.0"),release("1.0.1","revoked"),release("1.1.0")
  ])
  const verified=verifySignedRegistryEnvelope(signed,publicKeyPem)
  const active=listVerifiedAddons(verified)
  assert.equal(active.length,1)
  assert.equal(active[0].manifest.version,"1.1.0")
  assert.equal(active[0].status,"active")
})

test("the signed catalog is pinned and rejects tampered signatures", () => {
  const signed=envelope([release("1.0.0")])
  assert.throws(()=>verifySignedRegistryEnvelope(signed,otherKeyPem),/Untrusted registry signing key/)
  const tampered={...signed,signature:Buffer.alloc(64).toString("base64url")}
  assert.throws(()=>verifySignedRegistryEnvelope(tampered,publicKeyPem),/signature verification failed/)
  const changed={...signed,body:Buffer.from(JSON.stringify({schemaVersion:1,releases:[]})).toString("base64url")}
  assert.throws(()=>verifySignedRegistryEnvelope(changed,publicKeyPem),/signature verification failed/)
})

test("a returned signed payload cannot be mutated into an unapproved catalog",()=>{
  const verified=verifySignedRegistryEnvelope(envelope([release("1.0.0")]),publicKeyPem)
  verified.releases[0].manifest.version="2.0.0"
  assert.throws(()=>listVerifiedAddons(verified),/not verified or was modified/)
  assert.throws(()=>listVerifiedAddons({schemaVersion:1,updatedAt:new Date().toISOString(),releases:[]}),/not verified/)
})

test("signed but malformed asset metadata is still rejected",()=>{
  for(const change of [
    value=>{value.assetUrl="https://evil.example/download.tgz"},
    value=>{value.manifest.id="invalid"},
    value=>{value.size=100000000},
    value=>{value.status="unknown"},
    value=>{value.manifest.permissions=["server.routes"]}
  ]){
    const r=release("1.0.0")
    change(r)
    assert.throws(()=>verifySignedRegistryEnvelope(envelope([r]),publicKeyPem),/Invalid/)
  }
})

test("registry client fetches a bounded, non-redirected signed response",async()=>{
  const signed=envelope([release("1.0.0")])
  let observed
  const client=createVerifiedRegistryClient({
    registryUrl:"https://ngapi.m1nsook.com/v1/registry",
    pinnedPublicKeyPem:publicKeyPem,
    fetchImpl:async (url, options)=>{
      observed={url,options}
      return new Response(JSON.stringify(signed),{status:200,headers:{"Content-Type":"application/json"}})
    }
  })
  assert.equal((await client.listApproved())[0].manifest.version,"1.0.0")
  assert.equal(observed.url,"https://ngapi.m1nsook.com/v1/registry")
  assert.equal(observed.options.redirect,"error")
  assert.equal(observed.options.cache,"no-store")
})

test("registry client fails closed on unauthenticated origin and oversized body",async()=>{
  assert.throws(()=>createVerifiedRegistryClient({
    registryUrl:"http://example.com/v1/registry",pinnedPublicKeyPem:publicKeyPem
  }),/Expected an HTTPS/)
  assert.throws(()=>createVerifiedRegistryClient({
    registryUrl:"https://example.com/v1/registry",pinnedPublicKeyPem:""
  }),/Pinned registry public key/)
  const client=createVerifiedRegistryClient({
    registryUrl:"https://ngapi.m1nsook.com/v1/registry",
    pinnedPublicKeyPem:publicKeyPem,
    fetchImpl:async()=>new Response("x".repeat(4*1024*1024+1))
  })
  await assert.rejects(client.fetchVerified(),/Index too large/)
})
