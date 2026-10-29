# HagiCode npm publisher

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md)

一个组合式 GitHub Action，使用 npm 可信发布（OIDC）从调用方自己的 job 中发布 npm 包。同一套约定覆盖稳定版发布、开发版发布、多包发布以及失败诊断。

## 为什么使用组合式 Action

- **它在调用方的 job 内运行。** 发布步骤使用调用方 job 的 OIDC 令牌，因此实际执行 `npm publish` 的是调用方自己的工作流文件。npm 文档没有专门提到组合式 Action，所以在依赖它之前，已在真实运行中确认过这一点；参见 [docs/trusted-publishing-notes.md](docs/trusted-publishing-notes.md)。仓库采用此 Action 时，npmjs.com 上的任何设置都不会改变。
- **可复用工作流会改变被识别的身份。** 可复用工作流从被调用的 job 中发布。npm 文档说明，对于可复用工作流，验证检查的是*调用方*工作流的名称，也就是调用方本来就能控制的文件。本 Action 不依赖这一规则。
- **无需构建，没有依赖。** 脚本是放在 `scripts/` 下的普通 Node ESM，通过 `${{ github.action_path }}` 运行。没有需要提交的 `dist/`，脚本运行前也无需安装任何内容。

## 快速开始

调用方 job 需要 `contents: read` 和 `id-token: write` 权限，并且需要自行检出仓库。组合式 Action 无法设置 job 权限。

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

使用 `@v1` 可获取最新的兼容版本。若需要最严格的固定版本，请使用完整的 commit SHA：`HagiCode-org/hagicode-npm-publisher@<40-character-sha>`。

## 输入参数

| 输入 | 默认值 | 说明 |
| --- | --- | --- |
| `mode` | `auto` | `auto` 根据事件检测 dev 或 release。`dev` 需要推送到分支。`release` 需要已发布的 release 或稳定版标签推送。 |
| `package-manager` | `auto` | `auto` 在 `working-directory` 中存在 `pnpm-lock.yaml` 时选择 pnpm，否则选择 npm。可指定 `pnpm` 或 `npm`。 |
| `node-version` | `24` | 工具链步骤使用的 Node.js 版本。 |
| `working-directory` | `.` | 相对于仓库根目录的目录，包含包和锁文件。 |
| `packages` | `.` | 以换行分隔的包目录，按发布顺序排列。依赖项应放在前面。 |
| `provenance` | `true` | 使用 `--provenance` 发布。 |
| `access` | `public` | npm 访问级别：`public` 或 `restricted`。 |
| `dist-tag` | `""` | 覆盖 dist-tag。留空时，dev 模式为 `dev`，release 模式为 `latest`。dev 不能使用 `latest`；release 必须使用 `latest`。 |
| `registry-url` | `https://registry.npmjs.org` | npm registry 地址。 |
| `base-version` | `""` | dev 版本的 `X.Y.Z` 基础版本。留空时使用第一个包的 `package.json` 中的 `X.Y.Z`。 |
| `expected-repository` | `""` | 运行必须来自的 `owner/repo`。留空时为当前仓库。 |
| `expected-workflow` | `.github/workflows/npm-publish.yml` | npm 可信发布者所绑定的工作流文件。 |
| `install-command` | `auto` | `auto` 执行冻结锁文件的安装（`pnpm install --frozen-lockfile` 或 `npm ci`）。其他任何值都会替换它。留空则跳过安装。 |
| `typecheck-command` | `""` | 类型检查命令。留空则跳过该检查门。 |
| `build-command` | `""` | 构建命令。留空则跳过该检查门。 |
| `test-command` | `""` | 测试命令。留空则跳过该检查门。 |
| `after-version-command` | `""` | 在写入版本号之后运行，并设置 `PUBLISH_VERSION`、`PUBLISH_DIST_TAG` 和 `PUBLISH_MODE`。 |
| `registry-neutrality-command` | `""` | 由调用方负责的 registry 中立性检查。在测试之后、打包检查之前运行。 |
| `verify-command` | `""` | 由调用方负责的验证，例如包图断言。在发布前运行。 |
| `pack-check` | `true` | 对每个包运行 `npm pack --dry-run --json`，并拒绝泄露的文件。 |
| `verify-package` | `true` | 运行通用的清单规则：入口文件必须存在，且 provenance 必须与 `repository.url` 匹配。 |
| `verify-lockfile-stable` | `true` | 如果安装改变了锁文件则失败。通过 `git diff` 与索引比较检查。 |
| `skip-existing` | `true` | 跳过解析出的版本已存在于 registry 中的包。 |
| `summary` | `true` | 写入 job 摘要。 |
| `stamp-release-version` | `false` | 从稳定版标签改写 `package.json`，而不是要求其与标签匹配。 |
| `dry-run` | `false` | 运行到包验证为止的所有检查门，但从不调用 `npm publish`。 |

## 输出

| 输出 | 说明 |
| --- | --- |
| `version` | 解析出的版本（dev 或稳定版）。 |
| `dist-tag` | 使用的 dist-tag。 |
| `mode` | `dev` 或 `release`。 |
| `published` | 至少发布了一个包时为 `true`。 |
| `published-packages` | 已发布的 `name@version` 的 JSON 数组。 |
| `skipped-packages` | 因 registry 中已存在而跳过的 `name@version` 的 JSON 数组。 |
| `package-manager` | `pnpm` 或 `npm`。 |

即使没有发布任何内容，输出也会被写入。草稿或预发布 release 会将 `published` 设为 `false`，并在 job 摘要中说明原因。

## 检查门顺序

检查门按以下固定顺序运行。发布前的任何失败都会在不发布的情况下停止运行。即使失败，摘要仍会运行。

1. 上下文与验证：事件、模式、预期仓库和工作流文件、版本和 dist-tag。
2. 工具链：所选的 pnpm（如适用）和 Node.js。
3. 安装，然后检查锁文件是否稳定。
4. 写入版本号，然后运行 `after-version-command`。
5. 类型检查、构建、测试。
6. Registry 中立性命令。
7. 打包检查，然后包验证，然后 `verify-command`。
8. 发布，按列出的顺序逐个包发布。
9. 摘要。

`dry-run: true` 运行检查门 1 至 7，且从不调用 `npm publish`。

## 版本约定

### 稳定版

稳定版是 `vX.Y.Z` 形式的 release 标签（或 `vX.Y.Z` 标签推送）。草稿和预发布 release 从不发布。版本号为去掉 `v` 后的标签，并且每个列出的 `package.json` 都必须已经声明该版本。不一致会在安装前失败。设置 `stamp-release-version: true` 后，Action 会先把标签中的版本写入每个清单，适用于先打标签再升级版本的调用方。

稳定版发布到 `latest`。

### 开发版

开发版的格式为 `<base>-dev.<run>.<attempt>.<sha>`：

- `<base>` 为 `base-version`，或 `package.json` 中的 `X.Y.Z`。
- `<run>` 为 `GITHUB_RUN_NUMBER`（默认 `0`）。`<attempt>` 为 `GITHUB_RUN_ATTEMPT`（默认 `1`）。两者都必须是不带前导零的数字。
- `<sha>` 为 `GITHUB_SHA`，转为小写，移除 `[0-9a-z]` 之外的所有字符，然后截取为 7 个字符。
- 不包含时间戳。运行编号和尝试次数已经使版本唯一且有序。

开发版发布到 `dev`，从不移动 `latest`。

### `g` 前缀规则

当清理并截取后的 7 位 SHA 全部为数字时，Action 会在其前面加上 `g`。`1234567` 变为 `g1234567`，`0123456` 变为 `g0123456`。

原因在于 SemVer。全数字的标识符会被视为数字，前导零会使版本无效，因此 `npm version` 会拒绝 `X.Y.Z-dev.1.1.0123456`。全数字的短 SHA 还会按数值而非文本进行比较。随机生成的 7 位十六进制 SHA 中约有 3.7% 全为数字，因此这种情况会在真实推送中出现。

该规则是强制性的，并且有测试覆盖。前缀在截取到 7 个字符之后应用。在写入任何内容之前会运行自检：最终版本必须是有效的 SemVer，且缺少 `g` 的全数字 SHA 组件会被拒绝。

## 多包与关联发布

`packages` 即发布顺序，Action 不会对其排序。每个包使用相同的版本。列出的包之间的精确固定版本（`"dependency": "0.6.1"`）会被改写为新版本。`^0.6.0`、`workspace:` 和 `file:` 等范围保持不变，并会给出警告。

在发布每个包之前，Action 会向 registry 查询其版本。已存在的版本会被跳过并记录在 `skipped-packages` 中，因此稳定版的重新运行可以从中断处继续。registry 返回 `E404` 表示“尚无任何版本”。其他任何 registry 错误都会停止运行，因为在不确定的情况下假定版本不存在是不安全的。

第一个发布失败会停止循环。后面的包不会再尝试，因此依赖方永远不会先于其依赖项发布。

### 钩子

- `after-version-command` 在写入版本号之后、验证之前运行。用于仓库自身的同步，例如必须与写入的版本号保持一致的 SDK 版本。
- `verify-command` 在发布之前运行。用于仓库自定义的规则，例如包图断言。非零退出码会阻止发布。

## 失败诊断

当 `npm publish` 失败时，Action 会保留 npm 的输出和退出状态。随后，它会根据包名、`GITHUB_REPOSITORY` 以及 `GITHUB_WORKFLOW_REF` 中的工作流文件名，为该失败类别打印指引。类别如下：

- `E404`：确认 npm scope 存在，发布身份可以创建该包，并且可信发布者指定了正确的所有者、仓库、工作流文件和 environment。
- `E403`：确认该版本尚未发布，并且可信发布者允许本次运行。
- `E401` / `ENEEDAUTH`：没有 OIDC 变量时，授予 `id-token: write`。有 OIDC 变量时，检查可信发布者。
- `provenance`：将 `package.json` 中的 `repository.url` 与 GitHub 仓库进行比较。
- `unknown`：通用检查清单。

指引会写入 stderr、job 摘要，并作为一条错误注释输出。Action 打印的任何内容中的令牌都会被脱敏。

## 可信发布者检查清单

请在 npmjs.com 上为每个包核对以下项目。Action 不会更改这些设置。

- 所有者：GitHub 所有者，例如 `HagiCode-org`。
- 仓库：GitHub 仓库名称。
- 工作流文件名：`npm-publish.yml`（或 `expected-workflow` 指定的任何名称）。
- Environment：留空，除非调用方的 job 使用了 GitHub environment 且可信发布者中指定了该 environment。

npm 可信发布需要 npm CLI 11.5.1 或更高版本，以及 Node.js 22.14.0 或更高版本。Action 在发布前会检查 npm CLI 版本，若检查失败则会以升级指引退出。`node-version` 的默认值为 Node 24。

## 限制

- `npm publish` 不会改写 `workspace:` 说明符。发布的清单必须包含真实的版本范围。
- pnpm 版本来自 `package.json` 的 `packageManager` 字段。当 `package-manager` 解析为 pnpm 时，请设置该字段。
- `npm publish` 在每个包目录下以 `cwd` 运行，而不是使用 `--workspace`。单包和多包仓库使用同一种路径。
- Action 本身不运行构建或测试。这些命令由你通过输入参数传入。

## Registry 中立性

本 Action 不内置 registry 中立性检查。每个仓库保留自己的副本，由其已在使用的复制机制维护，并通过 `registry-neutrality-command` 传入。内置副本会形成第二个事实来源。当复制机制改变，或有超过两个调用方出现偏差时，应重新考虑此方案。

## 无 npm 配套包

本仓库不发布任何 npm 包。Action 本身就是产品，清单标记为 `private`。`scripts/cli.mjs` 为维护者提供本地 `resolve` 试运行和 `check-dist-tags` 辅助工具。只有当 GitHub Actions 之外出现使用者时，才需要添加包。

## 标签

`vX.Y.Z` 标签标记正式版本。工作流只会为最高的稳定版 `v1.Y.Z` 移动浮动标签 `v1`。预发布标签从不移动它。

## 开发

```sh
pnpm install
pnpm test
```

测试会针对夹具包运行真实的步骤脚本。`npm` 和 `pnpm` 会被 `PATH` 上的 shim 替换，因此没有任何测试会访问 registry。黄金文件只能通过 `pnpm run regenerate-goldens` 写入，该命令设有保护。
