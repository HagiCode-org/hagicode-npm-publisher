# Caller profiles

This is reference material. It records how each existing HagiCode npm workflow publishes today, and which action inputs reproduce it. **No caller is modified by this change.** Adoption is a separate decision.

Read on: 2026-10-28, from each caller's `.github/workflows/npm-publish.yml` and the release scripts it calls, read-only. HEAD at the time: imgbin `95e04e9`, cli `85ebf75`, hagiscript `499f008`, hagi18n `edc3c2e`, hagitask `474f49e`, hagilight `fb8173e0`, hagi-release-drafter `2e8bbb3`.

Every caller profile in `test/profiles/` replays its inputs through `dry-run` against a fixture package, and `test/golden/resolved/` pins the result.

## Corrections to design D12

The first survey of the callers (design D12) was checked against the workflows. These rows change:

| Caller | Design D12 said | Actual | Effect on the profile |
| --- | --- | --- | --- |
| cli | Tag-push trigger with strict `vX.Y.Z` tag | No tag-push trigger. Triggers are push to main and release published. The `vX.Y.Z` check applies to the release tag only. | Profile uses a published release. The action still accepts tag pushes, but cli does not use that path. |
| cli | Stable versions verified against `package.json` | `verify-release-version.mjs` only checks the tag regex. The workflow then runs `npm version`, which overwrites the manifest. | Stable behaviour matches `stamp-release-version: true`. Tag and manifest are not compared in cli today. |
| imgbin | Stable path validates, rewrites, then verifies | Confirmed. The verify step runs after the rewrite, so the tag-to-manifest comparison always passes. | `stamp-release-version: true` reproduces the rewrite. The action then compares the rewritten manifest with the tag, which is a real check. |
| hagitask | Release publishes with `--tag` | The release job publishes with no `--tag`, so it goes to `latest`. It also runs on `workflow_dispatch`. | Not reproduced by the action, which always passes a tag. This is a known difference to resolve before adoption. |
| hagi18n | Publish flags | Dev and stable publish without `--provenance`. | Profile sets `provenance: false`. |
| hagiscript | Prerequisites | `repository.url` must contain `github.com/HagiCode-org/hagiscript`, and `GITHUB_REPOSITORY` must equal it. | Generic check: with provenance on, `repository.url` must point to `GITHUB_REPOSITORY`. For this repository it is the same rule. The string `HagiCode-org/hagiscript` is not hard-coded in the action. |
| hagiscript | SDK sync at the workflow level | The SDK is built and synchronised through the `build:sdk` script, not the workflow step directly. | Runs through `after-version-command`. |
| hagilight | Publish | Uses `npm publish --workspace <name>`. The standalone package has no core dependency. | The action publishes with `cwd` at each package, not `--workspace`. Exact pins are rewritten only where a listed package targets a listed package. |
| hagi-release-drafter | Build step | No build step in the workflow. The build runs through `prepack` during `npm pack`. | Profile supplies `build-command` for explicitness. |
| hagi-release-drafter | Lockfile check | No lockfile-stability check, no registry-neutrality check. | Profile sets `verify-lockfile-stable: false`. |
| hagitask | Dev version | Inline: `package.json` base plus `-dev.<run number>`. No attempt, no SHA. | Documented difference; the action's dev version is different. |

`design.md` itself is not edited by this change. Its D12 table should be corrected to match this file, which is a follow-up for the artifact owner.

## Known differences from the action's contract

- **No timestamp.** imgbin's dev version includes a UTC timestamp. The action does not.
- **Run attempt default.** imgbin defaults the attempt to `0`; cli and hagiscript default to `1`. The action defaults to `1`. Outside GitHub Actions the variable is not set, so this only affects local runs.
- **Stable versions are verified, not rewritten, by default.** imgbin rewrites its manifest from the tag. Use `stamp-release-version: true` to keep that.
- **`workspace:` specifiers.** `npm publish` does not rewrite them. No caller publishes with `workspace:` today.
- **Provenance.** hagi18n publishes without it. Other callers publish with it.
- **Diagnostics.** imgbin's diagnostics hint is hard-coded to one package. The action builds its hints from the runtime package name and repository.

## Per-caller inputs

Each row is the input set that reproduces the caller. The profile file in `test/profiles/` holds the same values.

| Caller | Trigger | Inputs that reproduce it |
| --- | --- | --- |
| imgbin | push main (dev); release published (stable) | `stamp-release-version: "true"`, `package-manager: npm`, `build-command`, `test-command` |
| cli | push main (dev); release published (stable) | `package-manager: npm`, `typecheck-command`, `build-command`, `test-command` |
| hagi18n | push main (dev); release published (stable) | `package-manager: npm`, `provenance: "false"`, `pack-check: "true"` |
| hagitask | push main (dev); release published (stable, to latest) | `mode: dev` (minimal). The stable path needs a manual decision; see the hagitask correction above. |
| hagiscript | push main (dev); release published (stable) | `base-version` from its next-tag helper, `expected-repository: HagiCode-org/hagiscript`, `after-version-command` for the SDK sync |
| hagilight | push main (dev); release published (stable) | `packages` in dependency order, `expected-repository: HagiCode-org/hagilight`, `package-manager: pnpm`, `verify-command` for the graph assertion |
| hagi-release-drafter | push main (dev); release published (stable) | `mode: dev`, `package-manager: npm`, `build-command`, `typecheck-command`, `verify-lockfile-stable: "false"` |

`expected-repository` and `verify-command` values in the table name real repositories for the caller's own workflow. The profiles use the publisher's fixture repository instead, so the resolved outputs are reproducible.

## Trusted-publisher fields to verify on npmjs.com

For each package the caller publishes, check on npmjs.com that the trusted publisher has:

| Field | Value |
| --- | --- |
| Owner | `HagiCode-org` |
| Repository | the caller's repository name |
| Workflow filename | `npm-publish.yml` |
| Environment | empty, unless the caller's publish job declares one |

The action does not change these settings. The workflow filename must stay `npm-publish.yml`, so the trusted publisher remains valid.

## Migration runbook

This runbook is for later adoption. It does not change any caller.

1. **Order.** Batch 1: hagi18n, imgbin, cli. Batch 2: hagitask, hagi-release-drafter. Batch 3: hagiscript (with SDK synchronisation) and hagilight (with five ordered packages). Start a batch only when the previous batch has passed its acceptance checks.
2. **Per repository.** Change only `.github/workflows/npm-publish.yml`. Keep the file name and the job permissions `contents: read` and `id-token: write`. Keep the release scripts in place until a later cleanup.
3. **Rollback gate.** Keep the previous publishing jobs in the same `npm-publish.yml`, gated on an explicit `workflow_dispatch` input on `main`. Normal triggers run only the action job. A rollback therefore uses the same trusted-publisher filename.
4. **Acceptance.** After each batch, publish a `dev` version from `main` for every migrated caller. The new version must match the dev format, `dev` must point to it, and `latest` must be unchanged. Do not use a stable publication for validation.
5. **Check.** `node scripts/cli.mjs check-dist-tags --package <name> --latest <version-before> --dev <new-version>` exits non-zero and prints both values when `latest` has moved, or `dev` is not the expected version.
6. **Manual.** Verify the trusted-publisher fields above for each package before the first migrated publish.
