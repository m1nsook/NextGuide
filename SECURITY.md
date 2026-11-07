# Security policy

NextGuide aims to keep documentation and authentication data under the site owner's control.

## Reporting a vulnerability

**Do not open a public GitHub issue for exploitable vulnerabilities, leaked tokens, account takeover, or private data exposure.**

Use the repository [Security](https://github.com/m1nsook/NextGuide/security) page and choose **Report a vulnerability** if private vulnerability reporting is enabled. If GitHub doesn't offer that option, do not publish a proof-of-concept or credentials in Issues; contact a maintainer privately through a verified channel.

When reporting, include the affected NextGuide version, deployment mode, a minimal reproduction, security impact, and mitigations if known. Never include real passwords, TOTP seeds, recovery codes, or customer records.

## Supported versions

The published npm alpha channel is for early testing. **Account Mode's unreleased source implementation is not approved for production authentication.** Stable security support policies will be documented before the 1.0.0 release.

Keep Next.js, Bun/Node, and NextGuide up to date. Use HTTPS, private persistent storage, and least-privilege permissions for server deployments. See the [Account Mode security guide](https://m1nsook.github.io/NextGuide/docs/getting-started/account-mode/) for additional limitations.

No response or remediation deadline is guaranteed.
