# Trusted publishing notes

Verified facts behind the publisher's contract. Each entry names its source and the date it was checked. Anything not listed here as verified is not stated as fact in the README.

Checked: 2026-10-28.

## Verified against npm's documentation

Source: <https://docs.npmjs.com/trusted-publishers>, read on 2026-10-28.

1. **Minimum versions.** "Trusted publishing requires npm CLI version 11.5.1 or later and Node version 22.14.0 or higher." The publisher uses `MIN_NPM_VERSION = "11.5.1"` in `scripts/lib/exec.mjs`.

2. **Reusable workflows.** The documentation says that for reusable workflows, "validation checks the calling workflow's name instead of the workflow that actually contains the publish command". It also says `id-token: write` must be granted to both the parent and the child workflow. This is the rule for reusable workflows. The publisher does not use reusable workflows, so the README states this rule only as npm's documented behaviour for reusable workflows.

3. **Environment field.** It is optional. It applies when GitHub environments are used for deployment protection.

## Not verified

- **Composite actions.** npm's documentation does not mention composite actions. The design relies on the publish step running inside the caller's job, where the job's OIDC token and workflow identity belong to the caller. Confirm this with a real run of a caller that publishes through the action before the README presents it as a guarantee.
- **npm version bundled with Node 24.** The secondary sources found on 2026-10-28 say Node 24 ships npm 11, but none gave the exact bundled version. The action therefore does not depend on it.

## Decision: no `npm-version` input (task 1.2)

The action checks the installed npm CLI version before any publish (`preflightNpm` in `scripts/lib/exec.mjs`). If the version is below 11.5.1 it fails with the detected and required versions and tells the caller to run `npm install -g npm@latest` in an earlier step. No `npm-version` input is added. The check fires only when it is needed, and it names the fix. Revisit if the check fires in practice on `ubuntu-latest`.

## Failure modes this avoids

- A reusable-workflow publish that is validated against the wrong file (see item 2). The composite design keeps publish in the caller's job.
- A publish from a workflow file other than the one bound on npmjs.com. `resolve-context` refuses it before install, naming both paths.
- An older npm that cannot perform the OIDC exchange. Refused before publish.
