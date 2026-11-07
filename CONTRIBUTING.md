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

This builds and tests the package and produces a **fingerprinted** `nextguide-<version>-<hash>.tgz` archive in the repository root. The command prints the exact `bun add` command for that archive. Every rebuilt package has a distinct filename, so a stale alpha tarball cannot be mistaken for the current source build. In your separate application, install the archive using its actual path (relative or absolute), then run:

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

## Automated package build check

Every pull request and push to `main` runs the [NextGuide pack:dev workflow](.github/workflows/pack-dev.yml) on one standard Ubuntu runner. It installs dependencies and runs `bun run pack:dev`, including the package tests and npm packaging step. The generated `.tgz` is deleted after the check and is never uploaded or published.

A separate [build reporter](.github/workflows/pack-dev-report.yml) creates a `[pack:dev] PASS` or `[pack:dev] FAIL` issue for each completed run. Failure issues include an excerpt of the failing job's log and a link to its full Actions run. These results receive CI status labels rather than a triage label.

The automatic package build does not replace testing inside an actual Next.js consumer application, particularly for Account Mode and browser navigation.

For manual tests after updating the repository, always run `bun pack:dev` again **before** installing a local tarball. Running `bun add --force` against an old `.tgz` does not rebuild it. Use the fingerprinted filename printed by the pack command.

## Pull requests

Keep changes focused, explain their user-visible behavior, and include tests for bug fixes. Avoid modifying user-authored documentation while upgrading generated project files. Do not commit secrets, account state files, personal credentials, or production data.

NextGuide uses one npm package; do not split features into independent npm packages without a prior project decision.

## Releases

Publishing npm packages is a maintainer-only action. Development changes are not production-ready until packaged installation, runtime behavior, documentation, and security checks pass. Follow the [1.0.0 release gate](https://github.com/m1nsook/NextGuide/issues/31) for current status.

## License

Contributions are distributed under the project's MIT license. Preserve applicable third-party notices.
