import test from "node:test"
import assert from "node:assert/strict"
import { createHash, generateKeyPairSync, sign } from "node:crypto"
import { gzipSync } from "node:zlib"
import { verifyApprovedContentArchive } from "../lib/extension-artifacts.mjs"

const { publicKey, privateKey } = generateKeyPairSync("ed25519")
const pem = publicKey.export({ format: "pem", type: "spki" })
const keyId = createHash("sha256").update(publicKey.export({
  format: "der", type: "spki",
})).digest("hex").slice(0, 24)

const manifest = {
  schemaVersion: 1, id: "acme.documentation", name: "Documentation",
  version: "1.0.0", category: "content",
  repository: "https://github.com/acme/documentation",
  compatibility: { mode: "account", nextguide: ">=1.0.0 <2.0.0" },
  permissions: [], entrypoints: { content: "content" }, icon: "icon.png",
}
function png() {
  const icon = Buffer.alloc(48)
  Buffer.from([137,80,78,71,13,10,26,10]).copy(icon,0)
  icon.writeUInt32BE(13,8)
  icon.write("IHDR",12)
  icon.writeUInt32BE(32,16)
  icon.writeUInt32BE(32,20)
  return icon
}
function member(path, bytes, type = "0") {
  bytes = Buffer.from(bytes)
  const header = Buffer.alloc(512)
  header.write(path,0,100,"utf8")
  header.write("0000644\0",100,8,"ascii")
  header.write("0000000\0",108,8,"ascii")
  header.write("0000000\0",116,8,"ascii")
  header.write(bytes.length.toString(8).padStart(11,"0")+"\0",124,12,"ascii")
  header.write("00000000000\0",136,12,"ascii")
  header.fill(32,148,156)
  header.write(type,156)
  header.write("ustar\0",257)
  header.write("00",263)
  const checksum=header.reduce((sum,n)=>sum+n,0)
  header.write(checksum.toString(8).padStart(6,"0")+"\0 ",148,8)
  return Buffer.concat([header,bytes,Buffer.alloc((512-bytes.length%512)%512)])
}
function archive(files) {
  return gzipSync(Buffer.concat([...files.map(x=>member(...x)),Buffer.alloc(1024)]),
    { level: 9, mtime: 0 })
}
function goodFiles() {
  return [
    ["nextguide-addon.json",Buffer.from(JSON.stringify(manifest))],
    ["icon.png",png()],
    ["content/index.md",Buffer.from("# Hello from the approved add-on\n")],
  ]
}
function signed(archiveBytes, status = "active") {
  const release = {
    manifest, assetUrl: "https://github.com/acme/documentation/releases/download/v1.0.0/nextguide-addon-1.0.0.tgz",
    tag: "v1.0.0", commit: "b".repeat(40),
    digest: createHash("sha256").update(archiveBytes).digest("hex"),
    size: archiveBytes.length, status, reviewer: "approved-reviewer",
    approvedAt: "2026-11-08T00:00:00Z",
  }
  const body = Buffer.from(JSON.stringify({
    schemaVersion: 1, updatedAt: "2026-11-08T00:00:00Z", releases: [release],
  }))
  return { schemaVersion: 1, algorithm: "Ed25519", keyId,
    body: body.toString("base64url"),
    signature: sign(null, body, privateKey).toString("base64url") }
}
function verify(bytes, status = "active") {
  return verifyApprovedContentArchive({
    envelope: signed(bytes,status), pinnedPublicKeyPem: pem,
    id: manifest.id, version: manifest.version, archive: bytes,
  })
}

test("approves deterministic signed content-only tar with no extraction", () => {
  const raw = archive(goodFiles())
  const result = verify(raw)
  assert.equal(result.id, manifest.id)
  assert.equal(result.pages.length, 1)
  assert.match(result.pages[0].markdown,/approved add-on/)
  assert.equal(result.icon.bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a")
})

test("rejects altered bytes, wrong size, revoked release and spoofed signatures", () => {
  const raw=archive(goodFiles())
  const tampered=Buffer.from(raw);tampered[tampered.length-1]^=1
  assert.throws(()=>verifyApprovedContentArchive({
    envelope:signed(raw),pinnedPublicKeyPem:pem,id:manifest.id,
    version:manifest.version,archive:tampered,
  }),/SHA-256 mismatch/)
  assert.throws(()=>verify(raw,"revoked"),/No active signed release/)
  const forged=signed(raw)
  forged.signature=forged.signature.slice(0,-2)+"aa"
  assert.throws(()=>verifyApprovedContentArchive({
    envelope:forged,pinnedPublicKeyPem:pem,id:manifest.id,
    version:manifest.version,archive:raw,
  }),/signature/)
  assert.throws(()=>verifyApprovedContentArchive({
    envelope:signed(raw),pinnedPublicKeyPem:pem,id:manifest.id,
    version:manifest.version,archive:raw.subarray(1),
  }),/size/)
})

test("rejects path traversal and Windows case collisions even if archive digest is signed", () => {
  const traversal=archive([...goodFiles(),["../secret.md","unsafe"]])
  assert.throws(()=>verify(traversal),/Unsafe add-on archive path/)
  const collision=archive([...goodFiles(),["CONTENT/INDEX.md","duplicate"]])
  assert.throws(()=>verify(collision),/Duplicate or case-colliding/)
})

test("rejects tar symlinks, invalid header checksums and JS files", () => {
  const symlink=archive([...goodFiles(),["content/link.md","", "2"]])
  assert.throws(()=>verify(symlink),/Unsupported tar member type/)
  const javascript=archive([...goodFiles(),["content/install.js","danger"]])
  assert.throws(()=>verify(javascript),/unsupported file/)
  const tar = Buffer.concat([...goodFiles().map(x=>member(...x)),Buffer.alloc(1024)])
  tar[10]^=1 // corrupt a header name without recomputing checksum
  const modified=gzipSync(tar)
  assert.throws(()=>verify(modified),/header checksum/)
})

test("rejects unsupported manifest identity and empty content", () => {
  const mismatch={...manifest,id:"other.publisher"}
  const invalid=archive([["nextguide-addon.json",JSON.stringify(mismatch)],
    ["icon.png",png()],["content/index.md","# test"]])
  assert.throws(()=>verify(invalid),/Manifest does not match/)
  const empty=archive([["nextguide-addon.json",JSON.stringify(manifest)],
    ["icon.png",png()]])
  assert.throws(()=>verify(empty),/required members/)
})
