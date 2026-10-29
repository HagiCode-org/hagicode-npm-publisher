# HagiCode npm publisher

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md)

호출하는 쪽의 job에서 npm 신뢰할 수 있는 게시(OIDC)를 사용해 npm 패키지를 게시하는 복합 GitHub Action입니다. 하나의 규약으로 안정 릴리스, dev 게시, 다중 패키지 릴리스, 실패 진단을 모두 다룹니다.

## 복합 액션을 사용하는 이유

- **호출하는 쪽의 job 안에서 실행됩니다.** 게시 단계는 호출하는 job의 OIDC 토큰을 사용하므로, `npm publish`를 실행하는 것은 호출하는 쪽의 워크플로 파일입니다. npm 문서는 복합 액션을 이름으로 다루지 않기 때문에, 의존하기 전에 실제 실행으로 이를 확인했습니다. 자세한 내용은 [docs/trusted-publishing-notes.md](docs/trusted-publishing-notes.md)를 참고하세요. 저장소가 이 액션을 도입해도 npmjs.com의 설정은 변경되지 않습니다.
- **재사용 가능한 워크플로는 식별되는 주체를 바꿉니다.** 재사용 가능한 워크플로는 호출된 job에서 게시합니다. npm 문서에 따르면 재사용 가능한 워크플로의 경우 검증은 *호출하는* 워크플로의 이름을 확인하며, 이는 호출하는 쪽이 이미 제어하는 파일입니다. 이 액션은 해당 규칙에 의존하지 않습니다.
- **빌드도 의존성도 필요 없습니다.** 스크립트는 `scripts/` 아래에 있는 일반 Node ESM이며, `${{ github.action_path }}`를 통해 실행됩니다. 커밋해야 할 `dist/`가 없고, 스크립트가 실행되기 전에 설치할 것도 없습니다.

## 빠른 시작

호출하는 쪽의 job에는 `contents: read`와 `id-token: write` 권한이 필요하며, 저장소를 직접 체크아웃해야 합니다. 복합 액션은 job 권한을 설정할 수 없습니다.

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

최신 호환 릴리스를 사용하려면 `@v1`을 쓰세요. 가장 엄격하게 고정하려면 전체 commit SHA를 사용합니다: `HagiCode-org/hagicode-npm-publisher@<40-character-sha>`.

## 입력

| 입력 | 기본값 | 설명 |
| --- | --- | --- |
| `mode` | `auto` | `auto`는 이벤트를 보고 dev 또는 release를 판별합니다. `dev`는 브랜치에 대한 push가 필요합니다. `release`는 게시된 릴리스 또는 안정 태그 push가 필요합니다. |
| `package-manager` | `auto` | `auto`는 `working-directory`에 `pnpm-lock.yaml`이 있으면 pnpm을, 없으면 npm을 선택합니다. `pnpm` 또는 `npm`을 지정할 수 있습니다. |
| `node-version` | `24` | 도구 체인 단계에서 사용할 Node.js 버전입니다. |
| `working-directory` | `.` | 저장소 루트를 기준으로 한 디렉터리로, 패키지와 lockfile을 포함합니다. |
| `packages` | `.` | 줄바꿈으로 구분된 패키지 디렉터리 목록이며, 게시 순서대로 나열합니다. 의존성을 먼저 두세요. |
| `provenance` | `true` | `--provenance`를 붙여 게시합니다. |
| `access` | `public` | npm 접근 수준입니다: `public` 또는 `restricted`. |
| `dist-tag` | `""` | dist-tag를 재정의합니다. 비워 두면 dev 모드에서는 `dev`, release 모드에서는 `latest`가 됩니다. dev는 `latest`를 사용할 수 없고, release는 반드시 `latest`를 사용해야 합니다. |
| `registry-url` | `https://registry.npmjs.org` | npm 레지스트리 URL입니다. |
| `base-version` | `""` | dev 버전의 `X.Y.Z` 기준 버전입니다. 비워 두면 첫 번째 패키지의 `package.json`에 있는 `X.Y.Z`를 사용합니다. |
| `expected-repository` | `""` | 실행이 와야 하는 `owner/repo`입니다. 비워 두면 현재 저장소를 사용합니다. |
| `expected-workflow` | `.github/workflows/npm-publish.yml` | npm 신뢰할 수 있는 게시자가 연결된 워크플로 파일입니다. |
| `install-command` | `auto` | `auto`는 고정된 lockfile로 설치를 실행합니다(`pnpm install --frozen-lockfile` 또는 `npm ci`). 다른 값을 지정하면 이를 대체합니다. 비워 두면 설치를 건너뜁니다. |
| `typecheck-command` | `""` | 타입 검사 명령입니다. 비워 두면 이 게이트를 건너뜁니다. |
| `build-command` | `""` | 빌드 명령입니다. 비워 두면 이 게이트를 건너뜁니다. |
| `test-command` | `""` | 테스트 명령입니다. 비워 두면 이 게이트를 건너뜁니다. |
| `after-version-command` | `""` | 버전 기록 후에 실행되며, `PUBLISH_VERSION`, `PUBLISH_DIST_TAG`, `PUBLISH_MODE`가 설정됩니다. |
| `registry-neutrality-command` | `""` | 호출하는 쪽이 관리하는 레지스트리 중립성 검사입니다. 테스트 이후, 패키지 검사 이전에 실행됩니다. |
| `verify-command` | `""` | 패키지 그래프 단언처럼 호출하는 쪽이 관리하는 검증입니다. 게시 전에 실행됩니다. |
| `pack-check` | `true` | 각 패키지에 대해 `npm pack --dry-run --json`을 실행하고, 누출된 파일이 있으면 거부합니다. |
| `verify-package` | `true` | 일반 매니페스트 규칙을 실행합니다. 진입점이 존재해야 하고, provenance에는 일치하는 `repository.url`이 있어야 합니다. |
| `verify-lockfile-stable` | `true` | 설치가 lockfile을 바꾸면 실패합니다. 인덱스와 비교하는 `git diff`로 확인합니다. |
| `skip-existing` | `true` | 확인된 버전이 레지스트리에 이미 있는 패키지는 건너뜁니다. |
| `summary` | `true` | 작업 요약을 작성합니다. |
| `stamp-release-version` | `false` | 일치하는지 요구하는 대신, 안정 태그를 기준으로 `package.json`을 다시 씁니다. |
| `dry-run` | `false` | 패키지 검증까지의 모든 게이트를 실행하지만, `npm publish`는 절대 호출하지 않습니다. |

## 출력

| 출력 | 설명 |
| --- | --- |
| `version` | 확인된 버전(dev 또는 안정)입니다. |
| `dist-tag` | 사용된 dist-tag입니다. |
| `mode` | `dev` 또는 `release`입니다. |
| `published` | 패키지가 하나 이상 게시되었으면 `true`입니다. |
| `published-packages` | 게시된 `name@version`의 JSON 배열입니다. |
| `skipped-packages` | 레지스트리에 이미 있어서 건너뛴 `name@version`의 JSON 배열입니다. |
| `package-manager` | `pnpm` 또는 `npm`입니다. |

게시된 것이 없어도 출력은 기록됩니다. 초안 또는 프리릴리스는 `published`를 `false`로 설정하고, 그 이유를 작업 요약에 기록합니다.

## 게이트 순서

게이트는 다음의 고정된 순서로 실행됩니다. 게시 전 어느 단계든 실패하면 게시하지 않고 실행이 중단됩니다. 요약은 실패 이후에도 실행됩니다.

1. 컨텍스트와 검증: 이벤트, 모드, 예상 저장소와 워크플로 파일, 버전과 dist-tag.
2. 도구 체인: (선택된 경우) pnpm과 Node.js.
3. 설치, 그다음 lockfile 안정성 검사.
4. 버전 기록, 그다음 `after-version-command`.
5. 타입 검사, 빌드, 테스트.
6. 레지스트리 중립성 명령.
7. 패키지 검사, 그다음 패키지 검증, 그다음 `verify-command`.
8. 게시. 나열된 순서대로 패키지 단위로 게시합니다.
9. 요약.

`dry-run: true`는 게이트 1부터 7까지 실행하며, `npm publish`는 절대 호출하지 않습니다.

## 버전 관리 규약

### 안정 릴리스

안정 릴리스는 `vX.Y.Z` 릴리스 태그(또는 `vX.Y.Z` 태그 push)입니다. 초안과 프리릴리스는 절대 게시되지 않습니다. 버전은 `v`를 뺀 태그이며, 나열된 모든 `package.json`에 이미 그 버전이 선언되어 있어야 합니다. 불일치하면 설치 전에 실패합니다. `stamp-release-version: true`를 설정하면, 액션이 먼저 태그의 버전을 각 매니페스트에 기록합니다. 버전을 올리기 전에 태그를 먼저 붙이는 호출자를 위한 옵션입니다.

안정 버전은 `latest`로 게시됩니다.

### dev 버전

dev 버전의 형식은 `<base>-dev.<run>.<attempt>.<sha>`입니다:

- `<base>`는 `base-version`, 또는 `package.json`의 `X.Y.Z`입니다.
- `<run>`은 `GITHUB_RUN_NUMBER`(기본값 `0`)입니다. `<attempt>`는 `GITHUB_RUN_ATTEMPT`(기본값 `1`)입니다. 둘 다 앞에 0이 없는 숫자여야 합니다.
- `<sha>`는 `GITHUB_SHA`를 소문자로 바꾼 뒤 `[0-9a-z]` 바깥의 모든 문자를 제거하고, 7자로 자른 값입니다.
- 타임스탬프는 포함하지 않습니다. 실행 번호와 시도 번호만으로 버전이 고유하고 순서대로 정렬됩니다.

dev 버전은 `dev`로 게시되며, `latest`는 절대 옮기지 않습니다.

### `g` 접두사 규칙

정리한 7자리 SHA가 모두 숫자이면, 액션은 앞에 `g`를 붙입니다. `1234567`은 `g1234567`이 되고, `0123456`은 `g0123456`이 됩니다.

이유는 SemVer입니다. 숫자로만 이루어진 식별자는 숫자로 해석되며, 앞에 0이 붙으면 버전이 잘못된 것이 됩니다. 그래서 `npm version`은 `X.Y.Z-dev.1.1.0123456`을 거부합니다. 또한 숫자만으로 이루어진 짧은 SHA는 문자열이 아니라 숫자로 비교됩니다. 무작위 7자리 16진수 SHA의 약 3.7%는 모두 숫자이므로, 실제 push에서도 이런 경우가 발생합니다.

이 규칙은 필수이며 테스트로 검증됩니다. 접두사는 7자로 자른 뒤에 붙입니다. 아무것도 기록하기 전에 자체 검사가 실행됩니다. 최종 버전은 유효한 SemVer여야 하며, `g` 없이 모두 숫자로 된 SHA 구성 요소는 거부됩니다.

## 다중 패키지 및 연결된 릴리스

`packages`는 게시 순서입니다. 액션은 이를 정렬하지 않습니다. 각 패키지는 같은 버전을 받습니다. 나열된 패키지 사이의 정확한 고정 버전(`"dependency": "0.6.1"`)은 새 버전으로 다시 씁니다. `^0.6.0`, `workspace:`, `file:` 같은 범위는 그대로 두며, 경고로 알려 줍니다.

각 패키지를 게시하기 전에 액션은 레지스트리에 해당 패키지의 버전을 조회합니다. 이미 존재하는 버전은 건너뛰고 `skipped-packages`에 기록하므로, 안정 릴리스를 다시 실행해도 이어서 진행할 수 있습니다. 레지스트리의 `E404`는 "아직 버전이 없음"을 의미합니다. 그 밖의 레지스트리 오류는 실행을 중단시킵니다. 버전이 없다고 가정하는 것은 안전하지 않기 때문입니다.

첫 번째 게시 실패가 나면 반복문이 중단됩니다. 이후 패키지는 시도하지 않으므로, 의존하는 패키지가 의존 대상보다 먼저 나가는 일은 없습니다.

### 훅

- `after-version-command`는 버전 기록 후, 검증 전에 실행됩니다. 예를 들어 기록된 버전과 일치해야 하는 SDK 버전처럼, 저장소가 관리하는 동기화에 사용합니다.
- `verify-command`는 게시 전에 실행됩니다. 패키지 그래프 단언처럼 저장소가 관리하는 규칙에 사용합니다. 0이 아닌 종료 코드는 게시를 막습니다.

## 실패 진단

`npm publish`가 실패하면, 액션은 npm의 출력과 종료 상태를 그대로 유지합니다. 그다음 패키지 이름, `GITHUB_REPOSITORY`, `GITHUB_WORKFLOW_REF`의 워크플로 파일 이름으로 구성한 실패 유형별 안내를 출력합니다. 유형은 다음과 같습니다:

- `E404`: npm scope가 존재하는지, 게시 주체가 패키지를 만들 수 있는지, 신뢰할 수 있는 게시자가 올바른 소유자, 저장소, 워크플로 파일, environment를 지정했는지 확인하세요.
- `E403`: 해당 버전이 이미 게시되지 않았는지, 그리고 신뢰할 수 있는 게시자가 이 실행을 허용하는지 확인하세요.
- `E401` / `ENEEDAUTH`: OIDC 변수가 없으면 `id-token: write`를 부여하세요. OIDC 변수가 있으면 신뢰할 수 있는 게시자를 확인하세요.
- `provenance`: `package.json`의 `repository.url`을 GitHub 저장소와 비교하세요.
- `unknown`: 일반 체크리스트입니다.

안내는 stderr, 작업 요약, 그리고 하나의 오류 주석으로 기록됩니다. 액션이 출력하는 내용에서 토큰은 모두 마스킹됩니다.

## 신뢰할 수 있는 게시자 체크리스트

npmjs.com에서 패키지마다 다음 항목을 확인하세요. 액션은 이 설정을 변경하지 않습니다.

- Owner: GitHub 소유자, 예를 들어 `HagiCode-org`.
- Repository: GitHub 저장소 이름.
- Workflow filename: `npm-publish.yml`(또는 `expected-workflow`가 지정한 이름).
- Environment: 호출하는 쪽 job이 GitHub environment를 사용하고 신뢰할 수 있는 게시자가 그 environment를 지정한 경우가 아니라면 비워 둡니다.

npm 신뢰할 수 있는 게시에는 npm CLI 11.5.1 이상과 Node.js 22.14.0 이상이 필요합니다. 액션은 게시하기 전에 npm CLI 버전을 확인하며, 검사에 실패하면 업그레이드 안내와 함께 실패합니다. `node-version`의 기본값은 Node 24입니다.

## 제한 사항

- `npm publish`는 `workspace:` 지정자를 다시 쓰지 않습니다. 게시용 매니페스트에는 실제 버전 범위가 있어야 합니다.
- pnpm 버전은 `package.json`의 `packageManager` 필드에서 가져옵니다. `package-manager`가 pnpm으로 결정되면 이 필드를 설정하세요.
- `npm publish`는 `--workspace`가 아니라 각 패키지 디렉터리를 `cwd`로 사용합니다. 단일 패키지와 다중 패키지 저장소가 같은 경로를 공유합니다.
- 액션은 빌드나 테스트를 스스로 실행하지 않습니다. 이것들은 입력으로 전달하는 명령입니다.

## 레지스트리 중립성

레지스트리 중립성 검사는 번들로 포함되어 있지 않습니다. 각 저장소가 자체 사본을 유지하며, 이미 사용 중인 복사 메커니즘으로 관리하고, `registry-neutrality-command`로 전달합니다. 번들 사본을 두면 진실의 원천이 둘이 되기 때문입니다. 복사 메커니즘이 바뀌거나 호출자 몇 곳 이상에서 사본이 어긋나기 시작하면 이 결정을 다시 검토하세요.

## npm 동반 패키지 없음

이 저장소는 npm 패키지를 게시하지 않습니다. 액션 자체가 제품이며, 매니페스트는 `private`입니다. `scripts/cli.mjs`는 관리자에게 로컬 `resolve` 드라이 런과 `check-dist-tags` 도우미를 제공합니다. GitHub Actions 바깥에서 사용하는 소비자가 생길 때만 패키지를 추가하세요.

## 태그

`vX.Y.Z` 태그는 릴리스를 표시합니다. 워크플로는 가장 높은 안정 버전 `v1.Y.Z`에 대해서만 떠다니는 `v1` 태그를 옮깁니다. 프리릴리스 태그는 이를 옮기지 않습니다.

## 개발

```sh
npm install
npm test
```

테스트는 샘플 패키지를 대상으로 실제 단계 스크립트를 실행합니다. `npm`과 `pnpm`은 `PATH`에 있는 shim으로 대체되므로, 어떤 테스트도 레지스트리에 접속하지 않습니다. 골든 파일은 `npm run regenerate-goldens`로만 기록할 수 있으며, 이 명령은 보호되어 있습니다.
