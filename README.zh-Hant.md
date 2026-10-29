# HagiCode npm publisher

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md)

一個組合式 GitHub Action，使用 npm 可信發布（OIDC）從呼叫方自己的 job 中發布 npm 套件。同一套約定涵蓋穩定版發布、開發版發布、多套件發布以及失敗診斷。

## 為什麼使用組合式 Action

- **它在呼叫方的 job 內執行。** 發布步驟使用呼叫方 job 的 OIDC 權杖，因此實際執行 `npm publish` 的是呼叫方自己的工作流程檔案。npm 文件沒有專門提到組合式 Action，所以在依賴它之前，已在真實執行中確認過這一點；參見 [docs/trusted-publishing-notes.md](docs/trusted-publishing-notes.md)。儲存庫採用此 Action 時，npmjs.com 上的任何設定都不會改變。
- **可重複使用的工作流程會改變被識別的身分。** 可重複使用的工作流程從被呼叫的 job 中發布。npm 文件說明，對於可重複使用的工作流程，驗證檢查的是*呼叫方*工作流程的名稱，也就是呼叫方本來就能控制的檔案。本 Action 不依賴這一規則。
- **無需建置，沒有相依套件。** 腳本是放在 `scripts/` 下的一般 Node ESM，透過 `${{ github.action_path }}` 執行。沒有需要提交的 `dist/`，腳本執行前也無需安裝任何內容。

## 快速開始

呼叫方 job 需要 `contents: read` 與 `id-token: write` 權限，並且需要自行檢出儲存庫。組合式 Action 無法設定 job 權限。

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

使用 `@v1` 可取得最新的相容版本。若需要最嚴格的固定版本，請使用完整的 commit SHA：`HagiCode-org/hagicode-npm-publisher@<40-character-sha>`。

## 輸入參數

| 輸入 | 預設值 | 說明 |
| --- | --- | --- |
| `mode` | `auto` | `auto` 根據事件偵測 dev 或 release。`dev` 需要推送到分支。`release` 需要已發布的 release 或穩定版標籤推送。 |
| `package-manager` | `auto` | `auto` 在 `working-directory` 中存在 `pnpm-lock.yaml` 時選擇 pnpm，否則選擇 npm。可指定 `pnpm` 或 `npm`。 |
| `node-version` | `24` | 工具鏈步驟使用的 Node.js 版本。 |
| `working-directory` | `.` | 相對於儲存庫根目錄的目錄，包含套件和鎖定檔。 |
| `packages` | `.` | 以換行分隔的套件目錄，依發布順序排列。相依項目應放在前面。 |
| `provenance` | `true` | 使用 `--provenance` 發布。 |
| `access` | `public` | npm 存取層級：`public` 或 `restricted`。 |
| `dist-tag` | `""` | 覆寫 dist-tag。留空時，dev 模式為 `dev`，release 模式為 `latest`。dev 不能使用 `latest`；release 必須使用 `latest`。 |
| `registry-url` | `https://registry.npmjs.org` | npm registry 位址。 |
| `base-version` | `""` | dev 版本的 `X.Y.Z` 基礎版本。留空時使用第一個套件的 `package.json` 中的 `X.Y.Z`。 |
| `expected-repository` | `""` | 執行必須來自的 `owner/repo`。留空時為目前的儲存庫。 |
| `expected-workflow` | `.github/workflows/npm-publish.yml` | npm 可信發布者所綁定的工作流程檔案。 |
| `install-command` | `auto` | `auto` 執行凍結鎖定檔的安裝（`pnpm install --frozen-lockfile` 或 `npm ci`）。其他任何值都會取代它。留空則跳過安裝。 |
| `typecheck-command` | `""` | 型別檢查命令。留空則跳過該檢查關卡。 |
| `build-command` | `""` | 建置命令。留空則跳過該檢查關卡。 |
| `test-command` | `""` | 測試命令。留空則跳過該檢查關卡。 |
| `after-version-command` | `""` | 在寫入版本號之後執行，並設定 `PUBLISH_VERSION`、`PUBLISH_DIST_TAG` 與 `PUBLISH_MODE`。 |
| `registry-neutrality-command` | `""` | 由呼叫方負責的 registry 中立性檢查。在測試之後、打包檢查之前執行。 |
| `verify-command` | `""` | 由呼叫方負責的驗證，例如套件圖斷言。在發布前執行。 |
| `pack-check` | `true` | 對每個套件執行 `npm pack --dry-run --json`，並拒絕洩漏的檔案。 |
| `verify-package` | `true` | 執行通用的清單規則：入口檔案必須存在，且 provenance 必須與 `repository.url` 相符。 |
| `verify-lockfile-stable` | `true` | 若安裝改變了鎖定檔則失敗。透過 `git diff` 與索引比對檢查。 |
| `skip-existing` | `true` | 跳過解析出的版本已存在於 registry 中的套件。 |
| `summary` | `true` | 寫入 job 摘要。 |
| `stamp-release-version` | `false` | 從穩定版標籤改寫 `package.json`，而不是要求其與標籤相符。 |
| `dry-run` | `false` | 執行到套件驗證為止的所有檢查關卡，但從不呼叫 `npm publish`。 |

## 輸出

| 輸出 | 說明 |
| --- | --- |
| `version` | 解析出的版本（dev 或穩定版）。 |
| `dist-tag` | 使用的 dist-tag。 |
| `mode` | `dev` 或 `release`。 |
| `published` | 至少發布了一個套件時為 `true`。 |
| `published-packages` | 已發布的 `name@version` 的 JSON 陣列。 |
| `skipped-packages` | 因 registry 中已存在而跳過的 `name@version` 的 JSON 陣列。 |
| `package-manager` | `pnpm` 或 `npm`。 |

即使沒有發布任何內容，輸出也會被寫入。草稿或預發布 release 會將 `published` 設為 `false`，並在 job 摘要中說明原因。

## 檢查關卡順序

檢查關卡依以下固定順序執行。發布前的任何失敗都會在不發布的情況下停止執行。即使失敗，摘要仍會執行。

1. 上下文與驗證：事件、模式、預期的儲存庫與工作流程檔案、版本與 dist-tag。
2. 工具鏈：所選的 pnpm（如適用）與 Node.js。
3. 安裝，然後檢查鎖定檔是否穩定。
4. 寫入版本號，然後執行 `after-version-command`。
5. 型別檢查、建置、測試。
6. Registry 中立性命令。
7. 打包檢查，然後套件驗證，然後 `verify-command`。
8. 發布，依列出的順序逐一發布套件。
9. 摘要。

`dry-run: true` 執行關卡 1 至 7，且從不呼叫 `npm publish`。

## 版本約定

### 穩定版

穩定版是 `vX.Y.Z` 形式的 release 標籤（或 `vX.Y.Z` 標籤推送）。草稿與預發布 release 從不發布。版本號為去掉 `v` 後的標籤，且每個列出的 `package.json` 都必須已宣告該版本。不一致會在安裝前失敗。設定 `stamp-release-version: true` 後，Action 會先把標籤中的版本寫入每個清單，適用於先打標籤再升級版本的呼叫方。

穩定版發布到 `latest`。

### 開發版

開發版的格式為 `<base>-dev.<run>.<attempt>.<sha>`：

- `<base>` 為 `base-version`，或 `package.json` 中的 `X.Y.Z`。
- `<run>` 為 `GITHUB_RUN_NUMBER`（預設 `0`）。`<attempt>` 為 `GITHUB_RUN_ATTEMPT`（預設 `1`）。兩者都必須是不含前導零的數字。
- `<sha>` 為 `GITHUB_SHA`，轉為小寫，移除 `[0-9a-z]` 之外的所有字元，然後截取為 7 個字元。
- 不包含時間戳記。執行編號與嘗試次數已使版本唯一且有序。

開發版發布到 `dev`，從不移動 `latest`。

### `g` 前綴規則

當清理並截取後的 7 位 SHA 全部為數字時，Action 會在其前面加上 `g`。`1234567` 變為 `g1234567`，`0123456` 變為 `g0123456`。

原因在於 SemVer。全數字的識別碼會被視為數字，前導零會使版本無效，因此 `npm version` 會拒絕 `X.Y.Z-dev.1.1.0123456`。全數字的短 SHA 還會依數值而非文字進行比較。隨機產生的 7 位十六進位 SHA 中約有 3.7% 全為數字，因此這種情況會出現在真實的推送中。

此規則是強制性的，並且有測試涵蓋。前綴在截取到 7 個字元之後套用。在寫入任何內容之前會執行自我檢查：最終版本必須是有效的 SemVer，且缺少 `g` 的全數字 SHA 組件會被拒絕。

## 多套件與關聯發布

`packages` 即發布順序，Action 不會對其排序。每個套件使用相同的版本。列出的套件之間的精確固定版本（`"dependency": "0.6.1"`）會被改寫為新版本。`^0.6.0`、`workspace:` 與 `file:` 等範圍保持不變，並會給出警告。

在發布每個套件之前，Action 會向 registry 查詢其版本。已存在的版本會被跳過並記錄在 `skipped-packages` 中，因此穩定版的重新執行可以從中斷處繼續。registry 回傳 `E404` 表示「尚無任何版本」。其他任何 registry 錯誤都會停止執行，因為在不確定的情況下假設版本不存在是不安全的。

第一個發布失敗會停止迴圈。後面的套件不會再嘗試，因此依賴方永遠不會先於其依賴項發布。

### 掛鉤

- `after-version-command` 在寫入版本號之後、驗證之前執行。用於儲存庫自身的同步，例如必須與寫入的版本號保持一致的 SDK 版本。
- `verify-command` 在發布之前執行。用於儲存庫自訂的規則，例如套件圖斷言。非零結束碼會阻止發布。

## 失敗診斷

當 `npm publish` 失敗時，Action 會保留 npm 的輸出與結束狀態。接著，它會根據套件名稱、`GITHUB_REPOSITORY` 以及 `GITHUB_WORKFLOW_REF` 中的工作流程檔案名稱，為該失敗類別印出指引。類別如下：

- `E404`：確認 npm scope 存在、發布身分可以建立該套件，並且可信發布者指定了正確的擁有者、儲存庫、工作流程檔案與 environment。
- `E403`：確認該版本尚未發布，並且可信發布者允許本次執行。
- `E401` / `ENEEDAUTH`：沒有 OIDC 變數時，授予 `id-token: write`。有 OIDC 變數時，檢查可信發布者。
- `provenance`：將 `package.json` 中的 `repository.url` 與 GitHub 儲存庫進行比較。
- `unknown`：通用檢查清單。

指引會寫入 stderr、job 摘要，並作為一則錯誤註解輸出。Action 印出的任何內容中的權杖都會被遮蔽。

## 可信發布者檢查清單

請在 npmjs.com 上為每個套件核對以下項目。Action 不會變更這些設定。

- 擁有者：GitHub 擁有者，例如 `HagiCode-org`。
- 儲存庫：GitHub 儲存庫名稱。
- 工作流程檔案名稱：`npm-publish.yml`（或 `expected-workflow` 指定的任何名稱）。
- Environment：留空，除非呼叫方的 job 使用了 GitHub environment 且可信發布者中指定了該 environment。

npm 可信發布需要 npm CLI 11.5.1 或更新版本，以及 Node.js 22.14.0 或更新版本。Action 在發布前會檢查 npm CLI 版本，若檢查失敗則會以升級指引結束。`node-version` 的預設值為 Node 24。

## 限制

- `npm publish` 不會改寫 `workspace:` 說明符。發布的清單必須包含真實的版本範圍。
- pnpm 版本來自 `package.json` 的 `packageManager` 欄位。當 `package-manager` 解析為 pnpm 時，請設定該欄位。
- `npm publish` 在每個套件目錄下以 `cwd` 執行，而不是使用 `--workspace`。單一套件與多套件儲存庫使用相同的路徑。
- Action 本身不執行建置或測試。這些命令由你透過輸入參數傳入。

## Registry 中立性

本 Action 不內建 registry 中立性檢查。每個儲存庫保留自己的副本，由其已在使用的複製機制維護，並透過 `registry-neutrality-command` 傳入。內建副本會形成第二個事實來源。當複製機制改變，或有超過兩個呼叫方出現偏差時，應重新考慮此方案。

## 無 npm 配套套件

本儲存庫不發布任何 npm 套件。Action 本身就是產品，清單標記為 `private`。`scripts/cli.mjs` 為維護者提供本地 `resolve` 試執行與 `check-dist-tags` 輔助工具。只有當 GitHub Actions 之外出現使用者時，才需要新增套件。

## 標籤

`vX.Y.Z` 標籤標記正式版本。工作流程只會為最高的穩定版 `v1.Y.Z` 移動浮動標籤 `v1`。預發布標籤從不移動它。

## 開發

```sh
pnpm install
pnpm test
```

測試會針對範例套件執行真實的步驟腳本。`npm` 與 `pnpm` 會被 `PATH` 上的 shim 取代，因此沒有任何測試會連線到 registry。黃金檔案只能透過 `pnpm run regenerate-goldens` 寫入，該命令設有保護。
