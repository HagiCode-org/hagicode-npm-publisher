# HagiCode npm publisher

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md)

A composite GitHub Action that publishes npm packages from the caller's own job, using npm trusted publishing (OIDC). One contract covers stable releases, dev publishes, multi-package releases and failure diagnostics.

## Why a composite action

- **It runs inside the caller's job.** The publish step uses the caller job's OIDC token, so the caller's workflow file is the one that runs `npm publish`. npm's documentation does not address composite actions by name, so this is confirmed on a real run before it is relied on; see [docs/trusted-publishing-notes.md](docs/trusted-publishing-notes.md). Nothing in npmjs.com changes when a repository adopts the action.
- **A reusable workflow would change who is identified.** A reusable workflow publishes from a called job. npm's documentation says that for reusable workflows, validation checks the *calling* workflow's name, which is the file the caller already controls. This action does not rely on that rule.
- **No build, no dependencies.** The scripts are plain Node ESM under `scripts/`, run through `${{ github.action_path }}`. There is no `dist/` to commit and nothing to install before the scripts run.

## Quick start

The caller job needs `contents: read` and `id-token: write`, and it checks out the repository itself. A composite action cannot set job permissions.

```yaml
name: npm publish
on:
  push:
    branches: [main]
  release:
    types: [published]

concurrency:
  group: npm-publish-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: read
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' || (github.event_name == 'release' && !github.event.release.draft)
    steps:
      - uses: actions/checkout@v6
        with:
          ref: ${{ github.event_name == 'release' && github.event.release.tag_name || github.ref }}
          persist-credentials: false
      - uses: HagiCode-org/hagicode-npm-publisher@v1
        with:
          mode: auto
          build-command: npm run build
          test-command: npm test
```

Use `@v1` for the latest compatible release. For the strictest pin, use a full commit SHA: `HagiCode-org/hagicode-npm-publisher@<40-character-sha>`.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `mode` | `auto` | `auto` detects dev or release from the event. `dev` needs a push to a branch. `release` needs a published release or a stable tag push. |
| `package-manager` | `auto` | `auto` picks pnpm when `pnpm-lock.yaml` exists in `working-directory`, otherwise npm. `pnpm` or `npm`. |
| `node-version` | `24` | Node.js version for the toolchain step. |
| `working-directory` | `.` | Directory, relative to the repository root, that holds the packages and the lockfile. |
| `packages` | `.` | Newline-separated package directories, in publish order. Put dependencies first. |
| `provenance` | `true` | Publish with `--provenance`. |
| `access` | `public` | npm access level: `public` or `restricted`. |
| `dist-tag` | `""` | Override the dist-tag. Empty means `dev` in dev mode and `latest` in release mode. Dev may not use `latest`; release must use `latest`. |
| `registry-url` | `https://registry.npmjs.org` | npm registry URL. |
| `base-version` | `""` | `X.Y.Z` base for dev versions. Empty means the `X.Y.Z` of the first package's `package.json`. |
| `expected-repository` | `""` | `owner/repo` the run must come from. Empty means the current repository. |
| `expected-workflow` | `.github/workflows/npm-publish.yml` | Workflow file that the npm trusted publisher is bound to. |
| `install-command` | `auto` | `auto` runs a frozen-lockfile install (`pnpm install --frozen-lockfile` or `npm ci`). Any other value replaces it. Empty skips the install. |
| `typecheck-command` | `""` | Typecheck command. Empty skips the gate. |
| `build-command` | `""` | Build command. Empty skips the gate. |
| `test-command` | `""` | Test command. Empty skips the gate. |
| `after-version-command` | `""` | Runs after version stamping, with `PUBLISH_VERSION`, `PUBLISH_DIST_TAG` and `PUBLISH_MODE` set. |
| `registry-neutrality-command` | `""` | Caller-owned registry-neutrality check. Runs after tests and before pack checks. |
| `verify-command` | `""` | Caller-owned verification, such as a package-graph assertion. Runs before publish. |
| `pack-check` | `true` | Run `npm pack --dry-run --json` for each package and reject leaked files. |
| `verify-package` | `true` | Run the generic manifest rules: entry points exist, and provenance has a matching `repository.url`. |
| `verify-lockfile-stable` | `true` | Fail if the install changed the lockfile. Checked with `git diff` against the index. |
| `skip-existing` | `true` | Skip a package whose resolved version is already in the registry. |
| `summary` | `true` | Write the job summary. |
| `stamp-release-version` | `false` | Rewrite `package.json` from a stable tag, instead of requiring it to match. |
| `dry-run` | `false` | Run every gate up to package verification, but never call `npm publish`. |

## Outputs

| Output | Description |
| --- | --- |
| `version` | The resolved version (dev or stable). |
| `dist-tag` | The dist-tag used. |
| `mode` | `dev` or `release`. |
| `published` | `true` when at least one package was published. |
| `published-packages` | JSON array of `name@version` that were published. |
| `skipped-packages` | JSON array of `name@version` skipped because the registry already had them. |
| `package-manager` | `pnpm` or `npm`. |

Outputs are written even when nothing is published. A draft or prerelease release sets `published` to `false` and says why in the job summary.

## Gate order

The gates run in this fixed order. Any failure before publish stops the run without publishing. The summary runs even after a failure.

1. Context and validation: event, mode, expected repository and workflow file, version and dist-tag.
2. Toolchain: pnpm (when selected) and Node.js.
3. Install, then the lockfile-stability check.
4. Version stamping, then `after-version-command`.
5. Typecheck, build, test.
6. Registry-neutrality command.
7. Pack check, then package verification, then `verify-command`.
8. Publish, package by package in the listed order.
9. Summary.

`dry-run: true` runs gates 1 to 7 and never calls `npm publish`.

## Versioning contract

### Stable releases

A stable release is a `vX.Y.Z` release tag (or a `vX.Y.Z` tag push). Draft and prerelease releases never publish. The version is the tag without `v`, and every listed `package.json` must already declare it. A mismatch fails before install. With `stamp-release-version: true` the action writes the tag's version into each manifest first, for callers that tag before they bump.

Stable versions publish to `latest`.

### Dev versions

A dev version has the shape `<base>-dev.<run>.<attempt>.<sha>`:

- `<base>` is `base-version`, or the `X.Y.Z` of `package.json`.
- `<run>` is `GITHUB_RUN_NUMBER` (default `0`). `<attempt>` is `GITHUB_RUN_ATTEMPT` (default `1`). Both must be digits without leading zeros.
- `<sha>` is `GITHUB_SHA`, lowercased, with every character outside `[0-9a-z]` removed, then cut to 7 characters.
- There is no timestamp. Run number and attempt already make versions unique and ordered.

Dev versions publish to `dev`. They never move `latest`.

### The `g` prefix rule

When the cleaned 7-character SHA is all digits, the action prefixes it with `g`. `1234567` becomes `g1234567`, and `0123456` becomes `g0123456`.

The reason is SemVer. An all-digit identifier is read as a number. A leading zero makes the version invalid, so `npm version` would refuse `X.Y.Z-dev.1.1.0123456`. A short all-digit SHA would also be compared numerically instead of as text. About 3.7% of random 7-character hexadecimal SHAs are all digits, so this happens in real pushes.

The rule is mandatory and tested. The prefix is applied after cutting to 7 characters. A self-check runs before anything is written: the final version must be valid SemVer, and an all-digit SHA component without `g` is refused.

## Multi-package and linked releases

`packages` is the publish order. The action does not sort it. Each package gets the same version. Exact pins among listed packages (`"dependency": "0.6.1"`) are rewritten to the new version. Ranges such as `^0.6.0`, `workspace:` and `file:` are left alone, and a warning names them.

Before publishing each package, the action asks the registry for its versions. A version that already exists is skipped and recorded in `skipped-packages`, so a stable re-run can resume. A registry `E404` means "no versions yet". Any other registry error stops the run, because it is never safe to assume a version is absent.

The first publish failure stops the loop. Later packages are not attempted, so a dependent never goes out before its dependency.

### Hooks

- `after-version-command` runs after stamping and before verification. Use it for repository-owned synchronisation, such as an SDK version that must match the stamped version.
- `verify-command` runs before publish. Use it for repository-owned rules, such as a package-graph assertion. A non-zero exit blocks publication.

## Failure diagnostics

When `npm publish` fails, the action keeps npm's output and exit status. It then prints guidance for the failure class, built from the package name, `GITHUB_REPOSITORY` and the workflow filename in `GITHUB_WORKFLOW_REF`. The classes are:

- `E404`: confirm the npm scope exists, the publishing identity can create the package, and the trusted publisher names the right owner, repository, workflow file and environment.
- `E403`: confirm the version is not already published, and that the trusted publisher allows this run.
- `E401` / `ENEEDAUTH`: without OIDC variables, grant `id-token: write`. With them, check the trusted publisher.
- `provenance`: compare `repository.url` in `package.json` with the GitHub repository.
- `unknown`: a generic checklist.

The guidance is written to stderr, to the job summary, and as one error annotation. Tokens are redacted from anything the action prints.

## Trusted publisher checklist

Verify these for each package on npmjs.com. The action does not change these settings.

- Owner: the GitHub owner, for example `HagiCode-org`.
- Repository: the GitHub repository name.
- Workflow filename: `npm-publish.yml` (or whatever `expected-workflow` names).
- Environment: empty, unless the caller's job uses a GitHub environment and the trusted publisher names it.

npm trusted publishing needs npm CLI 11.5.1 or later and Node.js 22.14.0 or later. The action checks the npm CLI version before it publishes and fails with upgrade guidance if the check fails. Node 24 is the default for `node-version`.

## Limitations

- `workspace:` specifiers are not rewritten by `npm publish`. Publish manifests must contain real version ranges.
- The pnpm version comes from the `packageManager` field of `package.json`. Set that field when `package-manager` resolves to pnpm.
- `npm publish` uses `cwd` at each package directory, not `--workspace`. Single-package and multi-package repositories share one path.
- The action does not run builds or tests by itself. Those are your commands, passed as inputs.

## Registry neutrality

The registry-neutrality check is not bundled. Each repository keeps its own copy, maintained by the copy mechanism it already uses, and passes it in with `registry-neutrality-command`. A bundled copy would be a second source of truth. Revisit this when the copy mechanism changes or when more than a couple of callers drift.

## No npm companion package

This repository publishes no npm package. The action is the product, and the manifest is `private`. `scripts/cli.mjs` gives maintainers a local `resolve` dry run and a `check-dist-tags` helper. Add a package only if a consumer outside GitHub Actions appears.

## Tags

`vX.Y.Z` tags mark releases. A workflow moves the floating `v1` tag only for the highest stable `v1.Y.Z`. Prerelease tags never move it.

## Development

```sh
npm install
npm test
```

Tests run the real step scripts against fixture packages. `npm` and `pnpm` are replaced by shims on `PATH`, so no test contacts a registry. Golden files are written only by `npm run regenerate-goldens`, which is guarded.
