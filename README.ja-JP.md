# HagiCode npm publisher

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md)

呼び出し元のジョブから npm トラステッドパブリッシング（OIDC）を使って npm パッケージを公開する、複合 GitHub Action です。安定版リリース、dev 公開、複数パッケージのリリース、失敗時の診断を、ひとつの契約でカバーします。

## 複合アクションを採用する理由

- **呼び出し元のジョブの中で実行されます。** 公開ステップは呼び出し元ジョブの OIDC トークンを使うため、`npm publish` を実行するのは呼び出し元のワークフローファイルです。npm のドキュメントは複合アクションを名指しで扱っていないため、依存する前に実際の実行で確認しています。詳しくは [docs/trusted-publishing-notes.md](docs/trusted-publishing-notes.md) を参照してください。リポジトリがこのアクションを採用しても、npmjs.com 側の設定は変わりません。
- **再利用可能ワークフローだと、識別される主体が変わります。** 再利用可能ワークフローは、呼び出された側のジョブから公開します。npm のドキュメントによると、再利用可能ワークフローでは検証時に*呼び出し元*ワークフローの名前が確認されます。これは呼び出し元がすでに管理しているファイルです。このアクションは、このルールに依存しません。
- **ビルドも依存関係も不要です。** スクリプトは `scripts/` にあるプレーンな Node ESM で、`${{ github.action_path }}` 経由で実行されます。コミットすべき `dist/` はなく、スクリプトを実行する前にインストールするものもありません。

## クイックスタート

呼び出し元のジョブには `contents: read` と `id-token: write` が必要です。また、リポジトリのチェックアウトは呼び出し元で行います。複合アクションからジョブの権限を設定することはできません。

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

最新の互換リリースを使うには `@v1` を指定します。最も厳密に固定する場合は、コミットの完全な SHA を使ってください: `HagiCode-org/hagicode-npm-publisher@<40-character-sha>`。

## 入力

| 入力 | 既定値 | 説明 |
| --- | --- | --- |
| `mode` | `auto` | `auto` はイベントから dev か release かを判定します。`dev` にはブランチへの push が必要です。`release` には公開済みのリリース、または安定版タグの push が必要です。 |
| `package-manager` | `auto` | `auto` は `working-directory` に `pnpm-lock.yaml` があれば pnpm を、なければ npm を選びます。`pnpm` または `npm`。 |
| `node-version` | `24` | ツールチェーンのステップで使う Node.js のバージョン。 |
| `working-directory` | `.` | パッケージとロックファイルを含む、リポジトリルートからの相対ディレクトリ。 |
| `packages` | `.` | 公開順に並べた、改行区切りのパッケージディレクトリ。依存先を先に置いてください。 |
| `provenance` | `true` | `--provenance` 付きで公開します。 |
| `access` | `public` | npm のアクセスレベル: `public` または `restricted`。 |
| `dist-tag` | `""` | dist-tag を上書きします。空の場合は、dev モードでは `dev`、release モードでは `latest` になります。dev では `latest` を使えず、release では `latest` を使う必要があります。 |
| `registry-url` | `https://registry.npmjs.org` | npm レジストリの URL。 |
| `base-version` | `""` | dev バージョンの基になる `X.Y.Z`。空の場合は、最初のパッケージの `package.json` にある `X.Y.Z` を使います。 |
| `expected-repository` | `""` | 実行元として想定する `owner/repo`。空の場合は現在のリポジトリです。 |
| `expected-workflow` | `.github/workflows/npm-publish.yml` | npm のトラステッドパブリッシャーが紐付けられているワークフローファイル。 |
| `install-command` | `auto` | `auto` はロックファイルを固定したインストール（`pnpm install --frozen-lockfile` または `npm ci`）を実行します。それ以外の値を指定するとこれを置き換えます。空の場合はインストールを省略します。 |
| `typecheck-command` | `""` | 型チェックのコマンド。空の場合はゲートを省略します。 |
| `build-command` | `""` | ビルドのコマンド。空の場合はゲートを省略します。 |
| `test-command` | `""` | テストのコマンド。空の場合はゲートを省略します。 |
| `after-version-command` | `""` | バージョンの書き換え後に、`PUBLISH_VERSION`、`PUBLISH_DIST_TAG`、`PUBLISH_MODE` を設定して実行されます。 |
| `registry-neutrality-command` | `""` | 呼び出し元が管理するレジストリ中立性チェック。テストの後、パックチェックの前に実行されます。 |
| `verify-command` | `""` | 呼び出し元が管理する検証（パッケージグラフのアサーションなど）。公開の前に実行されます。 |
| `pack-check` | `true` | 各パッケージに対して `npm pack --dry-run --json` を実行し、混入したファイルを拒否します。 |
| `verify-package` | `true` | 共通のマニフェストルールを実行します。エントリポイントが存在すること、provenance の `repository.url` が一致することを確認します。 |
| `verify-lockfile-stable` | `true` | インストールによってロックファイルが変わった場合は失敗します。インデックスに対する `git diff` で確認します。 |
| `skip-existing` | `true` | 解決されたバージョンがすでにレジストリにあるパッケージをスキップします。 |
| `summary` | `true` | ジョブサマリーを書き込みます。 |
| `stamp-release-version` | `false` | 一致を要求する代わりに、安定版タグから `package.json` を書き換えます。 |
| `dry-run` | `false` | パッケージ検証までのすべてのゲートを実行しますが、`npm publish` は決して呼び出しません。 |

## 出力

| 出力 | 説明 |
| --- | --- |
| `version` | 解決されたバージョン（dev または安定版）。 |
| `dist-tag` | 使用された dist-tag。 |
| `mode` | `dev` または `release`。 |
| `published` | 少なくとも 1 つのパッケージが公開された場合は `true`。 |
| `published-packages` | 公開された `name@version` の JSON 配列。 |
| `skipped-packages` | レジストリにすでに存在していたためスキップされた `name@version` の JSON 配列。 |
| `package-manager` | `pnpm` または `npm`。 |

何も公開されなくても、出力は書き込まれます。ドラフトまたはプレリリースのリリースでは `published` が `false` になり、その理由がジョブサマリーに記載されます。

## ゲートの順序

ゲートは次の固定順序で実行されます。公開前にどこかで失敗した場合、公開せずに実行を停止します。サマリーは失敗の後でも実行されます。

1. コンテキストと検証: イベント、モード、想定されるリポジトリとワークフローファイル、バージョンと dist-tag。
2. ツールチェーン: pnpm（選択された場合）と Node.js。
3. インストール、その後ロックファイルの安定性チェック。
4. バージョンの書き換え、その後 `after-version-command`。
5. 型チェック、ビルド、テスト。
6. レジストリ中立性コマンド。
7. パックチェック、その後パッケージ検証、その後 `verify-command`。
8. 公開。リストされた順に、パッケージごとに公開します。
9. サマリー。

`dry-run: true` ではゲート 1 から 7 までを実行し、`npm publish` は決して呼び出しません。

## バージョニングの契約

### 安定版リリース

安定版リリースは、`vX.Y.Z` のリリースタグ（または `vX.Y.Z` タグの push）です。ドラフトとプレリリースは決して公開されません。バージョンは `v` を除いたタグの値で、リストされた各 `package.json` にそのバージョンが宣言されている必要があります。一致しない場合は、インストール前に失敗します。`stamp-release-version: true` の場合、アクションは先にタグのバージョンを各マニフェストに書き込みます。これは、バージョンを上げる前にタグを打つ呼び出し元向けです。

安定版は `latest` に公開されます。

### dev バージョン

dev バージョンの形式は `<base>-dev.<run>.<attempt>.<sha>` です:

- `<base>` は `base-version`、または `package.json` の `X.Y.Z` です。
- `<run>` は `GITHUB_RUN_NUMBER`（既定値 `0`）です。`<attempt>` は `GITHUB_RUN_ATTEMPT`（既定値 `1`）です。どちらも、先頭に 0 を含まない数字である必要があります。
- `<sha>` は、`GITHUB_SHA` を小文字にし、`[0-9a-z]` 以外の文字を取り除いたうえで、7 文字に切り詰めたものです。
- タイムスタンプは含みません。実行番号と試行回数だけで、バージョンの一意性と順序が保たれます。

dev バージョンは `dev` に公開されます。`latest` を移動することは決してありません。

### `g` プレフィックスの規則

整形後の 7 文字の SHA がすべて数字の場合、アクションは先頭に `g` を付けます。`1234567` は `g1234567` に、`0123456` は `g0123456` になります。

理由は SemVer です。数字だけの識別子は数値として解釈されます。先頭の 0 があるとバージョンが無効になるため、`npm version` は `X.Y.Z-dev.1.1.0123456` を拒否します。また、数字だけの短い SHA は文字列ではなく数値として比較されてしまいます。ランダムな 7 文字の 16 進数 SHA のうち約 3.7% は数字だけで構成されるため、実際の push でも起こります。

この規則は必須であり、テストされています。プレフィックスは 7 文字に切り詰めた後に付与されます。何かを書き込む前に自己チェックが実行されます。最終バージョンは有効な SemVer である必要があり、`g` のない数字だけの SHA 要素は拒否されます。

## 複数パッケージと連動したリリース

`packages` は公開順です。アクションは並べ替えを行いません。各パッケージには同じバージョンが付与されます。リストされたパッケージ同士の完全一致の固定（`"dependency": "0.6.1"`）は、新しいバージョンに書き換えられます。`^0.6.0`、`workspace:`、`file:` のような範囲指定は変更されず、その旨が警告に表示されます。

各パッケージを公開する前に、アクションはレジストリにそのバージョン一覧を問い合わせます。既に存在するバージョンはスキップされて `skipped-packages` に記録されるため、安定版の再実行は途中から再開できます。レジストリの `E404` は「まだバージョンがない」を意味します。それ以外のレジストリエラーは実行を停止します。バージョンが存在しないと推定するのは決して安全ではないためです。

最初の公開失敗でループは停止します。後続のパッケージは試行されないため、依存先より先に依存元が公開されることはありません。

### フック

- `after-version-command` はバージョン書き換えの後、検証の前に実行されます。SDK のバージョンを書き込まれたバージョンに合わせる必要があるなど、リポジトリ側で管理する同期処理に使います。
- `verify-command` は公開の前に実行されます。パッケージグラフのアサーションなど、リポジトリ側で管理するルールに使います。終了コードがゼロ以外だと、公開はブロックされます。

## 失敗時の診断

`npm publish` が失敗すると、アクションは npm の出力と終了ステータスを保持します。そのうえで、パッケージ名、`GITHUB_REPOSITORY`、`GITHUB_WORKFLOW_REF` にあるワークフローファイル名から組み立てた、失敗の種類ごとのガイダンスを表示します。分類は次のとおりです:

- `E404`: npm の scope が存在すること、公開を行う主体がパッケージを作成できること、トラステッドパブリッシャーが正しい所有者、リポジトリ、ワークフローファイル、環境を指定していることを確認してください。
- `E403`: そのバージョンがまだ公開されていないこと、トラステッドパブリッシャーがこの実行を許可していることを確認してください。
- `E401` / `ENEEDAUTH`: OIDC の変数がない場合は `id-token: write` を付与してください。変数がある場合は、トラステッドパブリッシャーを確認してください。
- `provenance`: `package.json` の `repository.url` と GitHub リポジトリを比較してください。
- `unknown`: 汎用のチェックリスト。

ガイダンスは stderr、ジョブサマリー、そして 1 件のエラーアノテーションに出力されます。アクションが出力する内容からトークンは伏せられます。

## トラステッドパブリッシャーのチェックリスト

各パッケージについて、npmjs.com で次を確認してください。アクションはこれらの設定を変更しません。

- Owner: GitHub の所有者（例: `HagiCode-org`）。
- Repository: GitHub のリポジトリ名。
- Workflow filename: `npm-publish.yml`（または `expected-workflow` で指定したもの）。
- Environment: 呼び出し元のジョブが GitHub の environment を使い、トラステッドパブリッシャーがそれを指定している場合を除き、空にします。

npm のトラステッドパブリッシングには、npm CLI 11.5.1 以降と Node.js 22.14.0 以降が必要です。アクションは公開前に npm CLI のバージョンを確認し、確認に失敗した場合はアップグレードの案内とともに失敗します。`node-version` の既定値は Node 24 です。

## 制限事項

- `npm publish` は `workspace:` の指定子を書き換えません。公開するマニフェストには、実際のバージョン範囲が含まれている必要があります。
- pnpm のバージョンは、`package.json` の `packageManager` フィールドから取得されます。`package-manager` が pnpm に解決される場合は、そのフィールドを設定してください。
- `npm publish` は `--workspace` ではなく、各パッケージディレクトリの `cwd` を使います。単一パッケージのリポジトリと複数パッケージのリポジトリは、同じパスを共有します。
- アクション自体はビルドやテストを実行しません。それらは入力として渡す、あなたのコマンドです。

## レジストリ中立性

レジストリ中立性チェックはアクションに同梱されていません。各リポジトリが独自のコピーを保持し、既に使っているコピー機構で管理したうえで、`registry-neutrality-command` を通じて渡します。同梱すると、情報源が二つになってしまうためです。コピー機構が変わったとき、または呼び出し元が数件を超えてずれ始めたときに、この方針を見直します。

## npm の補助パッケージはなし

このリポジトリは npm パッケージを公開しません。製品はアクションそのものであり、マニフェストは `private` です。`scripts/cli.mjs` は、メンテナ向けにローカルでの `resolve` ドライランと `check-dist-tags` ヘルパーを提供します。GitHub Actions 以外の利用者が現れた場合にのみ、パッケージを追加します。

## タグ

`vX.Y.Z` タグはリリースを示します。ワークフローが移動させるのは、最も高い安定版 `v1.Y.Z` に対する浮動タグ `v1` だけです。プレリリースのタグがこれを移動させることはありません。

## 開発

```sh
npm install
npm test
```

テストは、フィクスチャパッケージに対して実際のステップスクリプトを実行します。`npm` と `pnpm` は `PATH` 上のシムに置き換えられるため、テストがレジストリにアクセスすることはありません。ゴールデンファイルは `npm run regenerate-goldens` でのみ書き込まれ、このコマンドは保護されています。
