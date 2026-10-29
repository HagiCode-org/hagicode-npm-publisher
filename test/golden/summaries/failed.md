## npm publish

| Field | Value |
| --- | --- |
| Mode | dev |
| Version | `0.6.1-dev.57.2.ab12cd9` |
| Dist-tag | dev |
| Package manager | pnpm |
| Dry run | no |

**Published:** `@hagicode/fixture-core@0.6.1-dev.57.2.ab12cd9`, `@hagicode/fixture-standalone@0.6.1-dev.57.2.ab12cd9`

**Skipped (already in registry):** _none_

**Not attempted:** `@hagicode/fixture-feature-b@0.6.1-dev.57.2.ab12cd9`, `@hagicode/fixture-feature-c@0.6.1-dev.57.2.ab12cd9`

### Gates

| Gate | Result |
| --- | --- |
| Context and validation | passed |
| pnpm setup | passed |
| Node setup | passed |
| Install dependencies | passed |
| Lockfile stability | passed |
| Version stamping | passed |
| after-version-command | skipped |
| Typecheck | skipped |
| Build | skipped |
| Test | passed |
| Registry-neutrality command | skipped |
| Pack check and package verification | passed |
| verify-command | skipped |
| Publish | failed |

### Warnings

- @hagicode/fixture-feature-c dependencies.@hagicode/fixture-core is "^0.6.0" and was left unchanged; only an exact pin (0.6.1) is rewritten

### Failure

**@hagicode/fixture-feature-a@0.6.1-dev.57.2.ab12cd9** (dist-tag `dev`) failed with class `E404`.

- Confirm that the npm scope "@hagicode" exists and that the publishing identity can create or update "@hagicode/fixture-feature-a".
- Confirm that the trusted publisher for "@hagicode/fixture-feature-a" on npmjs.com must name owner/repository "HagiCode-org/example", workflow filename ".github/workflows/npm-publish.yml" and the environment (if one is used).

