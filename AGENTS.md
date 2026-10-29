# AGENTS.md

Conventions for working in `hagicode-npm-publisher`, the composite GitHub Action that publishes HagiCode npm packages.

## Shape

- One composite action at the root (`action.yml`). Callers reference `HagiCode-org/hagicode-npm-publisher@v1`.
- Scripts are plain Node ESM under `scripts/`, run through `${{ github.action_path }}`. Logic lives in `scripts/lib/`. Keep each step script thin.
- **No runtime dependencies.** Node built-ins only. The only dev dependency is `yaml`, used by the contract test.
- **No build step and no `dist/`.** The action runs the committed `.mjs` files directly.
- Node 24 is the target. The npm CLI must be 11.5.1 or later for trusted publishing; `scripts/lib/exec.mjs` checks it.

## Versioning rules (mandatory)

- Dev versions are `<base>-dev.<run>.<attempt>.<sha>`, with no timestamp.
- **The `g` prefix is mandatory.** When the cleaned 7-character SHA is all digits, prefix it with `g`. Apply the prefix after slicing. Never remove it, and never add a special case that skips it.
- The self-check in `assertDevVersion` must stay. A version that fails it must never reach `npm version` or the registry.
- Golden cases for this rule live in `test/golden/g-prefix/table.json`. Add a row for any new case you find.

## Releasing this action

- `.github/workflows/release-draft.yml` drafts the next `vX.Y.Z` release on every push to `main`, through `HagiCode-org/hagi-release-drafter`. It never publishes. Use Conventional Commits so the bump is right (`feat` is minor, `feat!` or `BREAKING CHANGE:` is major, anything else is patch).
- Publishing the draft in the GitHub UI creates the tag. `release-tags.yml` then moves the floating major tag (`v1`) that callers reference.
- The repository has no release tag yet, so the drafter would derive `0.1.0`. Run the workflow once by hand with `version: 1.0.0` to cut the first release.
- `package.json` stays `private` at `0.1.0`. The release tag is the version; do not bump the manifest.

## Hard rules

- **No caller names in `scripts/`.** No repository names, package names or caller-specific behaviour. Those reach the action through inputs. `test/action-contract.test.mjs` enforces this.
- **Dry runs never reach the registry or npm publish.** Tests replace `npm` and `pnpm` with shims on `PATH`. No test may contact a real registry.
- **Golden files are read by tests and written only by `pnpm run regenerate-goldens`**, which is guarded by `REGENERATE_GOLDENS=yes`. Review every golden diff before committing it.
- Do not add a workflow, script or input that edits a caller repository. Callers are not modified by this repository.
- Do not state a fact about npm trusted publishing in a README unless it is recorded in `docs/trusted-publishing-notes.md` with its source.

## Commands

```sh
pnpm install
pnpm test                # all unit, contract, golden and profile tests
pnpm run test:contract   # action.yml and README parity only
pnpm run regenerate-goldens   # refuses to run without REGENERATE_GOLDENS=yes
```

Run the suite with `NODE_OPTIONS=--max-old-space-size=24576` on a shared machine. Tests run children with a scrubbed environment (only the shims, node and the system path), so no live data is visible to them.

## Layout

- `action.yml`: inputs, outputs and the fixed gate order.
- `scripts/lib/`: `inputs`, `semver`, `version`, `packages`, `registry`, `exec`, `diagnostics`, `summary`, `state`, `context`, `tags`, `pack-rules`, `redact`.
- `scripts/`: one entry point per step (`resolve-context`, `stamp-versions`, `verify-lockfile`, `verify-packages`, `publish`, `summarize`), plus `cli.mjs` for maintainers and `release-tag.mjs` for the floating tag.
- `test/unit/`, `test/action-contract.test.mjs`, `test/readme-parity.test.mjs`: tests.
- `test/fixtures/`: sample packages, npm/pnpm shims, event payloads, npm outputs.
- `test/golden/`: golden diagnostics, summaries, resolved contexts and the `g`-prefix table.
- `test/profiles/`: one input profile per existing caller.
- `docs/`: `trusted-publishing-notes.md` (verified npm facts) and `caller-profiles.md` (caller mapping and migration runbook).
