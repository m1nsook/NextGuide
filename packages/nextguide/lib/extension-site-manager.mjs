/**
 * Account Mode-only orchestration for approved, Markdown-only v1 add-ons.
 * Import only from trusted, owner-authenticated Next.js server routes.
 *
 * The private ngapi catalog signs releases; this service never handles
 * signing secrets or runs any code downloaded from the registry.
 */
import { createRequire } from "node:module"
import { createVerifiedRegistryClient, verifySignedRegistryEnvelope,
  listVerifiedAddons } from "./extension-catalog.mjs"
import { downloadVerifiedContentRelease } from "./extension-download.mjs"
import { createAccountAddonStore, compatibleAddonRange } from "./extension-install-state.mjs"

const require = createRequire(import.meta.url)
const VERSION = require("../package.json").version
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const MAX_FRESHNESS = 60 * 60 * 1000

function reject(code,message) {
  const error = new Error("NextGuide add-on manager: " + message)
  error.code = code
  throw error
}
function approvedInput(id, version, expectedRevision) {
  if (typeof id !== "string" || !ID.test(id) ||
      (version !== undefined && (typeof version !== "string" || !SEMVER.test(version))) ||
      !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    reject("INVALID_REQUEST", "Invalid release identity or installation revision")
  }
}
export function createAccountAddonManager({
  project = process.cwd(),
  dataDir,
  nextguideVersion = VERSION,
  registryUrl = process.env.NEXTGUIDE_ADDON_REGISTRY_URL,
  pinnedPublicKeyPem = process.env.NEXTGUIDE_ADDON_REGISTRY_PUBLIC_KEY_B64
    ? Buffer.from(process.env.NEXTGUIDE_ADDON_REGISTRY_PUBLIC_KEY_B64,"base64").toString("utf8") : "",
  now = () => Date.now(),
  registryFetch,
  resolver,
  transport,
} = {}) {
  const store = createAccountAddonStore({project,dataDir,nextguideVersion,now})
  const configured = typeof registryUrl === "string" && registryUrl.length > 0 &&
    typeof pinnedPublicKeyPem === "string" && pinnedPublicKeyPem.length > 0
  const registry = configured ? createVerifiedRegistryClient({
    registryUrl,pinnedPublicKeyPem,...(registryFetch?{fetchImpl:registryFetch}:{})
  }) : null

  async function signed() {
    if (!registry) reject("NO_REGISTRY", "Trusted signed registry is not configured")
    const envelope = await registry.fetchSignedEnvelope()
    const payload = verifySignedRegistryEnvelope(envelope,pinnedPublicKeyPem)
    const age = now() - Date.parse(payload.updatedAt)
    if (!Number.isFinite(age) || age > MAX_FRESHNESS || age < -5*60*1000) {
      reject("STALE_CATALOG", "Registry release catalog must be signed within the last hour")
    }
    return {envelope,payload}
  }
  function requireConsent(value) {
    if (value !== true) reject("CONSENT_REQUIRED", "Explicit site-owner consent is required")
  }

  return {
    async catalog() {
      const installed=store.list()
      if (!registry) return {configured:false,releases:[],installed,
        nextguideVersion}
      const {payload}=await signed()
      return {
        configured:true,
        releases:listVerifiedAddons(payload).map(release=>({
          ...release,
          compatible:compatibleAddonRange(
            release.manifest.compatibility.nextguide,nextguideVersion)
        })),
        installed,nextguideVersion,
      }
    },
    async install({id,version,expectedRevision,consent}={}) {
      approvedInput(id,version,expectedRevision)
      requireConsent(consent)
      const {envelope,payload}=await signed()
      const release=payload.releases.find(r=>r.manifest.id===id&&r.manifest.version===version)
      if (!release || release.status!=="active" || release.manifest.schemaVersion!==1 ||
          release.manifest.category!=="content" || release.manifest.permissions.length!==0 ||
          !compatibleAddonRange(release.manifest.compatibility.nextguide,nextguideVersion)) {
        reject("NOT_APPROVED", "Release is not reviewed, active or compatible with this NextGuide")
      }
      // No arbitrary caller URL: the signed envelope supplies the only URL.
      const archive=await downloadVerifiedContentRelease({
        envelope,pinnedPublicKeyPem,id,version,
        ...(resolver?{resolver}:{}),...(transport?{transport}:{})
      })
      return store.install({envelope,pinnedPublicKeyPem,id,version,archive,expectedRevision})
    },
    async toggle({id,enabled,expectedRevision}={}) {
      approvedInput(id,undefined,expectedRevision)
      if (typeof enabled!=="boolean") reject("INVALID_REQUEST","Expected enable/disable state")
      if (!enabled) return store.setEnabled({id,enabled:false,expectedRevision})
      const {envelope}=await signed()
      return store.setEnabled({id,enabled:true,expectedRevision,envelope,pinnedPublicKeyPem})
    },
    async rollback({id,version,expectedRevision,consent}={}) {
      approvedInput(id,version,expectedRevision)
      requireConsent(consent)
      const {envelope}=await signed()
      return store.rollback({id,version,expectedRevision,envelope,pinnedPublicKeyPem})
    },
    uninstall({id,expectedRevision,consent}={}) {
      approvedInput(id,undefined,expectedRevision)
      requireConsent(consent)
      return store.uninstall({id,expectedRevision})
    },
    /** Privileged API for a future safe Markdown-only public page adapter. */
    async readEnabled({id}={}) {
      if (typeof id!=="string" || !ID.test(id)) reject("INVALID_REQUEST","Invalid add-on ID")
      const {envelope}=await signed()
      return store.readEnabled({id,envelope,pinnedPublicKeyPem})
    },
  }
}
