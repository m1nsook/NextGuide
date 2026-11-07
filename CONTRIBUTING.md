# Contributing to NextGuide

Thank you for helping improve NextGuide. Bug reports, documentation fixes, tests, and code changes are welcome.

## Before you start

- Read the [documentation](https://m1nsook.github.io/NextGuide/).
- Search existing [issues](https://github.com/m1nsook/NextGuide/issues) before opening a new one.
- For the current 1.0.0 release scope, see [release acceptance #31](https://github.com/m1nsook/NextGuide/issues/31).

## Development environment

Use Node.js 20 or newer and Bun. Clone the repository using Git or a graphical Git client, then run these commands from the repository root:

```bash
bun install
bun run dev
```

The workspace contains the single publishable package in `packages/nextguide` and the official documentation application in `apps/web`. Workspace packages are for development only; users install the single `nextguide` npm package.

## Testing a local package

Use a **separate Next.js project** for installation testing. From the NextGuide source repository:

```bash
bun run pack:dev
```

This builds and tests the package and produces a `nextguide-<version>.tgz` archive in the repository root. In your separate application, install the archive using its actual path (relative or absolute), then run:

```bash
bunx nextguide init --developer
bun run dev
```

Do not install the repository workspace root as a dependency. Do not assume the published npm alpha contains unmerged changes.

## Useful checks

```bash
bun run --cwd packages/nextguide test
bun run build:web
bun run compat:next
bun run compat:account
```

The compatibility scripts build real packed-package consumers and require the dependencies indicated in each test. To check browser routing, start an installed documentation site, then run:

```bash
NEXTGUIDE_TEST_URL=http://127.0.0.1:3000/docs node scripts/verify-docs-navigation-browser.mjs
```

The browser check requires Chrome or Chromium; set `NEXTGUIDE_CHROME` to the executable path if necessary. These checks run locally and do not require GitHub Actions.

## Pull requests

Keep changes focused, explain their user-visible behavior, and include tests for bug fixes. Avoid modifying user-authored documentation while upgrading generated project files. Do not commit secrets, account state files, personal credentials, or production data.

NextGuide uses one npm package; do not split features into independent npm packages without a prior project decision.

## Releases

Publishing npm packages is a maintainer-only action. Development changes are not production-ready until packaged installation, runtime behavior, documentation, and security checks pass. Follow the [1.0.0 release gate](https://github.com/m1nsook/NextGuide/issues/31) for current status.

## License

Contributions are distributed under the project's MIT license. Preserve applicable third-party notices.
