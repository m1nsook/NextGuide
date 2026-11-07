# NextGuide Registry v1 — development service

**Status: implementation under development, not deployed or cleared for production.**

This service is separate from the single `nextguide` npm package. It is designed for a future `ngapi.m1nsook.com` deployment on an existing Ubuntu VPS behind nginx, using Node 20+ or Bun, **without Docker**.

## Architecture

- Developers create add-ons from the [NextGuide-Addons template](https://github.com/m1nsook/NextGuide-Addons). The template supports a publisher-owned PNG icon.
- `bun ng-addon pack` creates a versioned `.tgz` archive with the manifest, icon and Markdown content.
- `bun ng-addon publish` verifies the committed GitHub source, creates a GitHub Release and submits `repository`, `tag`, `commit`, `assetUrl` and `sha256` to `POST /v1/submissions`. A GitHub token is sent **only to GitHub**, never to the registry.
- The registry fetches the release from GitHub, verifies archive bytes, SHA-256, manifest, icon and every file's Git blob SHA against the pinned source commit. No third-party code runs on the server.
- The authenticated registry owner opens **`https://ngapi.m1nsook.com/admin`** to approve/reject submissions. Approval re-verifies the release and writes a signed registry entry. Discord webhook notification is sent when a new add-on or new version arrives.
- NextGuide Account Mode's future marketplace is **inside its authenticated `/admin` panel only**, not a public `/marketplace` route. The public `/v1` API serves catalog metadata to installed sites; it is not a public marketplace UI.
- Actual archive files live on GitHub Releases, **not on your VPS**. Installer code must verify the pinned SHA-256 and signature before installing. The installer and full extension runtime are not finished.

Only Markdown content and a small validated PNG icon are supported in this first format. SVG, third-party JavaScript, OAuth hooks and privileged extensions need a separate reviewed permission/sandbox API before being enabled.

## HTTP API

| Endpoint | Who | Description |
| --- | --- | --- |
| `GET /healthz` | Public | Health check |
| `GET /v1/registry` | Public | Signed Ed25519 release index |
| `GET /v1/addons` | Public metadata | Filtered approved catalog (search, version, category) |
| `GET /v1/addons/{id}` | Public metadata | Latest approved release and icon |
| `GET /v1/addons/{id}/versions` | Public metadata | Release history and revocations |
| `GET /v1/addons/{id}/updates?from=x.y.z&nextguide=1.0.0` | Public metadata | Latest compatible approved update |
| `POST /v1/submissions` | Publisher | Verify public GitHub release and queue for review |
| `GET /admin` | Owner session | Private publishing review dashboard |
| `POST /admin/review/{uuid}/approve` | Owner session + CSRF | Re-verify and sign acceptance |
| `POST /admin/review/{uuid}/reject` | Owner session + CSRF | Reject submission |

The public catalog is deliberately read-only. No unauthenticated installation, settings edits or add-on execution occurs here.

## Local development

With Node.js 22+ installed:

```bash
node --test apps/registry/test/*.test.mjs
node apps/registry/cli.mjs keygen --dir /tmp/ng-signing-keys
node apps/registry/cli.mjs init --data /tmp/ng-registry-data --key /tmp/ng-signing-keys/registry.private.pem
```

Set `NG_REGISTRY_DATA_DIR`, `NG_REGISTRY_PUBLIC_KEY_FILE`, `NG_REGISTRY_PRIVATE_KEY_FILE`, `NG_REGISTRY_ADMIN_SECRET`, `NG_REGISTRY_SESSION_SECRET`, and `NG_REGISTRY_PUBLIC_ORIGIN` before starting. See [the environment template](.env.example). To test the public read-only catalog without owner approval, the server can run without a private key and admin secrets.

```bash
bun apps/registry/server.mjs
```

The registry should always listen on **127.0.0.1:4389** in production; nginx alone exposes the HTTPS public endpoint.

## Deployment configuration

Server-specific environment, systemd, TLS and nginx configuration is deliberately not kept in the repository. These files are delivered separately as a private, placeholder-only ZIP to the maintainer. Never commit live credentials, webhook URLs, signing keys or environment files.

**Security limitation:** Owner authentication, concurrent review operations and isolated signing still need production hardening. Do not expose this prototype publicly before those checks pass.

## What remains

- A safe Account Mode installer: signed catalog key pinning, archive digest validation, install/enable/disable/update/uninstall with rollback, and protected filesystem handling.
- Owner dashboard security hardening, verified account identity, submission persistence against concurrency, GitHub asset re-checks and stricter admission controls.
- Marketplace cards and full add-on pages inside **Account Mode /admin only**.
- Real VPS configuration and deployment confirmation.
