# HagiCode npm publisher

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md)

Eine zusammengesetzte GitHub Action, die npm-Pakete aus dem eigenen Job des Aufrufers veröffentlicht, über npm Trusted Publishing (OIDC). Ein einziger Vertrag deckt stabile Releases, Dev-Veröffentlichungen, Releases mit mehreren Paketen und Fehlerdiagnosen ab.

## Warum eine Composite Action

- **Sie läuft im Job des Aufrufers.** Der Veröffentlichungsschritt verwendet das OIDC-Token des Job des Aufrufers, daher führt die Workflow-Datei des Aufrufers `npm publish` aus. Die npm-Dokumentation behandelt Composite Actions nicht namentlich, deshalb wird dies bei einem echten Lauf bestätigt, bevor man sich darauf verlässt; siehe [docs/trusted-publishing-notes.md](docs/trusted-publishing-notes.md). Auf npmjs.com ändert sich nichts, wenn ein Repository die Action übernimmt.
- **Ein wiederverwendbarer Workflow würde ändern, wer identifiziert wird.** Ein wiederverwendbarer Workflow veröffentlicht aus einem aufgerufenen Job. Laut npm-Dokumentation prüft die Validierung bei wiederverwendbaren Workflows den Namen des *aufrufenden* Workflows, also die Datei, die der Aufrufer ohnehin kontrolliert. Diese Action verlässt sich nicht auf diese Regel.
- **Kein Build, keine Abhängigkeiten.** Die Skripte sind einfaches Node-ESM unter `scripts/` und laufen über `${{ github.action_path }}`. Es gibt kein `dist/`, das committet werden müsste, und vor der Ausführung der Skripte ist nichts zu installieren.

## Schnellstart

Der Job des Aufrufers benötigt `contents: read` und `id-token: write`, und er checkt das Repository selbst aus. Eine Composite Action kann keine Job-Berechtigungen setzen.

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

Verwenden Sie `@v1` für das neueste kompatible Release. Für die strengste Festlegung verwenden Sie einen vollständigen Commit-SHA: `HagiCode-org/hagicode-npm-publisher@<40-character-sha>`.

## Eingaben

| Eingabe | Standard | Beschreibung |
| --- | --- | --- |
| `mode` | `auto` | `auto` erkennt Dev oder Release anhand des Events. `dev` benötigt einen Push auf einen Branch. `release` benötigt ein veröffentlichtes Release oder einen Push eines stabilen Tags. |
| `package-manager` | `auto` | `auto` wählt pnpm, wenn `pnpm-lock.yaml` in `working-directory` existiert, sonst npm. `pnpm` oder `npm`. |
| `node-version` | `24` | Node.js-Version für den Toolchain-Schritt. |
| `working-directory` | `.` | Verzeichnis relativ zur Repository-Wurzel, das die Pakete und das Lockfile enthält. |
| `packages` | `.` | Zeilengetrennte Paketverzeichnisse in Veröffentlichungsreihenfolge. Abhängigkeiten zuerst angeben. |
| `provenance` | `true` | Mit `--provenance` veröffentlichen. |
| `access` | `public` | npm-Zugriffsstufe: `public` oder `restricted`. |
| `dist-tag` | `""` | Überschreibt den dist-tag. Leer bedeutet `dev` im Dev-Modus und `latest` im Release-Modus. Dev darf nicht `latest` verwenden; Release muss `latest` verwenden. |
| `registry-url` | `https://registry.npmjs.org` | npm-Registry-URL. |
| `base-version` | `""` | `X.Y.Z`-Basis für Dev-Versionen. Leer bedeutet das `X.Y.Z` der `package.json` des ersten Pakets. |
| `expected-repository` | `""` | `owner/repo`, von dem der Lauf stammen muss. Leer bedeutet das aktuelle Repository. |
| `expected-workflow` | `.github/workflows/npm-publish.yml` | Workflow-Datei, an die der npm Trusted Publisher gebunden ist. |
| `install-command` | `auto` | `auto` führt eine Installation mit eingefrorenem Lockfile aus (`pnpm install --frozen-lockfile` oder `npm ci`). Jeder andere Wert ersetzt sie. Leer überspringt die Installation. |
| `typecheck-command` | `""` | Typecheck-Befehl. Leer überspringt das Gate. |
| `build-command` | `""` | Build-Befehl. Leer überspringt das Gate. |
| `test-command` | `""` | Test-Befehl. Leer überspringt das Gate. |
| `after-version-command` | `""` | Läuft nach dem Setzen der Version, mit gesetzten `PUBLISH_VERSION`, `PUBLISH_DIST_TAG` und `PUBLISH_MODE`. |
| `registry-neutrality-command` | `""` | Vom Aufrufer verantwortete Prüfung der Registry-Neutralität. Läuft nach den Tests und vor den Pack-Prüfungen. |
| `verify-command` | `""` | Vom Aufrufer verantwortete Verifikation, etwa eine Assertion über den Paketgraphen. Läuft vor der Veröffentlichung. |
| `pack-check` | `true` | Führt `npm pack --dry-run --json` für jedes Paket aus und lehnt ungewollt enthaltene Dateien ab. |
| `verify-package` | `true` | Führt die generischen Manifestregeln aus: Einstiegspunkte existieren, und die Provenance hat eine passende `repository.url`. |
| `verify-lockfile-stable` | `true` | Schlägt fehl, wenn die Installation das Lockfile geändert hat. Geprüft mit `git diff` gegen den Index. |
| `skip-existing` | `true` | Überspringt ein Paket, dessen aufgelöste Version bereits in der Registry steht. |
| `summary` | `true` | Schreibt die Job-Zusammenfassung. |
| `stamp-release-version` | `false` | Schreibt `package.json` anhand eines stabilen Tags um, statt Übereinstimmung zu verlangen. |
| `dry-run` | `false` | Führt alle Gates bis zur Paketverifikation aus, ruft aber niemals `npm publish` auf. |

## Ausgaben

| Ausgabe | Beschreibung |
| --- | --- |
| `version` | Die aufgelöste Version (Dev oder stabil). |
| `dist-tag` | Der verwendete dist-tag. |
| `mode` | `dev` oder `release`. |
| `published` | `true`, wenn mindestens ein Paket veröffentlicht wurde. |
| `published-packages` | JSON-Array mit `name@version` der veröffentlichten Pakete. |
| `skipped-packages` | JSON-Array mit `name@version` der übersprungenen Pakete, weil die Registry sie bereits hat. |
| `package-manager` | `pnpm` oder `npm`. |

Ausgaben werden auch dann geschrieben, wenn nichts veröffentlicht wird. Ein Draft- oder Prerelease-Release setzt `published` auf `false` und begründet dies in der Job-Zusammenfassung.

## Reihenfolge der Gates

Die Gates laufen in dieser festen Reihenfolge. Jeder Fehler vor der Veröffentlichung beendet den Lauf, ohne etwas zu veröffentlichen. Die Zusammenfassung wird auch nach einem Fehler geschrieben.

1. Kontext und Validierung: Event, Modus, erwartetes Repository und Workflow-Datei, Version und dist-tag.
2. Toolchain: pnpm (wenn ausgewählt) und Node.js.
3. Installation, danach die Prüfung der Lockfile-Stabilität.
4. Versionsstempelung, danach `after-version-command`.
5. Typecheck, Build, Test.
6. Befehl zur Registry-Neutralität.
7. Pack-Prüfung, danach Paketverifikation, danach `verify-command`.
8. Veröffentlichung, Paket für Paket in der angegebenen Reihenfolge.
9. Zusammenfassung.

`dry-run: true` führt die Gates 1 bis 7 aus und ruft niemals `npm publish` auf.

## Versionierungsvertrag

### Stabile Releases

Ein stabiles Release ist ein Release-Tag `vX.Y.Z` (oder ein Push eines Tags `vX.Y.Z`). Draft- und Prerelease-Releases werden nie veröffentlicht. Die Version ist der Tag ohne `v`, und jede aufgelistete `package.json` muss sie bereits deklarieren. Eine Abweichung schlägt vor der Installation fehl. Mit `stamp-release-version: true` schreibt die Action zuerst die Version des Tags in jedes Manifest, für Aufrufer, die vor dem Erhöhen der Version taggen.

Stabile Versionen werden nach `latest` veröffentlicht.

### Dev-Versionen

Eine Dev-Version hat die Form `<base>-dev.<run>.<attempt>.<sha>`:

- `<base>` ist `base-version` oder das `X.Y.Z` der `package.json`.
- `<run>` ist `GITHUB_RUN_NUMBER` (Standard `0`). `<attempt>` ist `GITHUB_RUN_ATTEMPT` (Standard `1`). Beide müssen Ziffern ohne führende Nullen sein.
- `<sha>` ist `GITHUB_SHA` in Kleinbuchstaben. Alle Zeichen außerhalb von `[0-9a-z]` werden entfernt, danach wird auf 7 Zeichen gekürzt.
- Es gibt keinen Zeitstempel. Lauf-Nummer und Versuch machen Versionen bereits eindeutig und geordnet.

Dev-Versionen werden nach `dev` veröffentlicht. Sie verschieben `latest` nie.

### Die `g`-Präfix-Regel

Wenn der bereinigte 7-stellige SHA nur aus Ziffern besteht, stellt die Action ihm ein `g` voran. Aus `1234567` wird `g1234567`, aus `0123456` wird `g0123456`.

Der Grund liegt in SemVer. Ein rein numerischer Bezeichner wird als Zahl gelesen. Eine führende Null macht die Version ungültig, daher würde `npm version` `X.Y.Z-dev.1.1.0123456` ablehnen. Ein kurzer, rein numerischer SHA würde außerdem numerisch statt als Text verglichen. Etwa 3,7 % zufälliger 7-stelliger hexadezimaler SHAs bestehen nur aus Ziffern, das kommt also bei echten Pushes vor.

Die Regel ist verpflichtend und getestet. Das Präfix wird nach dem Kürzen auf 7 Zeichen angewendet. Vor dem Schreiben läuft eine Selbstprüfung: Die endgültige Version muss gültiges SemVer sein, und ein rein numerischer SHA-Bestandteil ohne `g` wird abgelehnt.

## Releases mit mehreren und verknüpften Paketen

`packages` ist die Veröffentlichungsreihenfolge. Die Action sortiert sie nicht. Jedes Paket erhält dieselbe Version. Exakte Pins zwischen aufgelisteten Paketen (`"dependency": "0.6.1"`) werden auf die neue Version umgeschrieben. Bereiche wie `^0.6.0`, `workspace:` und `file:` bleiben unverändert, und eine Warnung nennt sie.

Vor der Veröffentlichung jedes Pakets fragt die Action die Registry nach dessen Versionen ab. Eine bereits vorhandene Version wird übersprungen und in `skipped-packages` vermerkt, sodass ein erneuter Lauf eines stabilen Releases fortgesetzt werden kann. Ein Registry-`E404` bedeutet „noch keine Versionen“. Jeder andere Registry-Fehler beendet den Lauf, denn es ist nie sicher anzunehmen, dass eine Version fehlt.

Der erste Veröffentlichungsfehler beendet die Schleife. Spätere Pakete werden nicht versucht, sodass ein abhängiges Paket nie vor seiner Abhängigkeit erscheint.

### Hooks

- `after-version-command` läuft nach der Stempelung und vor der Verifikation. Verwenden Sie ihn für vom Repository verantwortete Synchronisation, etwa eine SDK-Version, die mit der gestempelten Version übereinstimmen muss.
- `verify-command` läuft vor der Veröffentlichung. Verwenden Sie ihn für vom Repository verantwortete Regeln, etwa eine Assertion über den Paketgraphen. Ein Exit-Code ungleich null verhindert die Veröffentlichung.

## Fehlerdiagnose

Wenn `npm publish` fehlschlägt, behält die Action die Ausgabe und den Exit-Status von npm bei. Danach gibt sie Hinweise zur Fehlerklasse aus, die aus dem Paketnamen, `GITHUB_REPOSITORY` und dem Workflow-Dateinamen in `GITHUB_WORKFLOW_REF` gebildet werden. Die Klassen sind:

- `E404`: Prüfen Sie, ob der npm-Scope existiert, ob die veröffentlichende Identität das Paket anlegen kann und ob der Trusted Publisher den richtigen Owner, das richtige Repository, die richtige Workflow-Datei und die richtige Environment nennt.
- `E403`: Prüfen Sie, ob die Version noch nicht veröffentlicht ist und ob der Trusted Publisher diesen Lauf zulässt.
- `E401` / `ENEEDAUTH`: Ohne OIDC-Variablen `id-token: write` setzen. Mit ihnen den Trusted Publisher prüfen.
- `provenance`: Vergleichen Sie `repository.url` in `package.json` mit dem GitHub-Repository.
- `unknown`: Eine allgemeine Checkliste.

Die Hinweise werden nach stderr, in die Job-Zusammenfassung und als eine Fehlerannotation geschrieben. Token werden aus allem geschwärzt, was die Action ausgibt.

## Checkliste für den Trusted Publisher

Prüfen Sie dies für jedes Paket auf npmjs.com. Die Action ändert diese Einstellungen nicht.

- Owner: der GitHub-Owner, zum Beispiel `HagiCode-org`.
- Repository: der Name des GitHub-Repositorys.
- Workflow-Dateiname: `npm-publish.yml` (oder was `expected-workflow` angibt).
- Environment: leer, es sei denn, der Job des Aufrufers verwendet eine GitHub-Environment und der Trusted Publisher nennt sie.

Npm Trusted Publishing benötigt npm CLI 11.5.1 oder neuer und Node.js 22.14.0 oder neuer. Die Action prüft die npm-CLI-Version vor der Veröffentlichung und bricht mit Upgrade-Hinweisen ab, wenn die Prüfung fehlschlägt. Node 24 ist der Standard für `node-version`.

## Einschränkungen

- `npm publish` schreibt `workspace:`-Angaben nicht um. Veröffentlichte Manifeste müssen echte Versionsbereiche enthalten.
- Die pnpm-Version stammt aus dem Feld `packageManager` der `package.json`. Setzen Sie dieses Feld, wenn `package-manager` zu pnpm aufgelöst wird.
- `npm publish` verwendet `cwd` im Verzeichnis jedes Pakets, nicht `--workspace`. Repositories mit einem und mit mehreren Paketen folgen demselben Weg.
- Die Action führt von sich aus keine Builds oder Tests aus. Das sind Ihre Befehle, die als Eingaben übergeben werden.

## Neutralität der Registry

Die Prüfung der Registry-Neutralität ist nicht mitgeliefert. Jedes Repository hält eine eigene Kopie, die über den bereits verwendeten Kopiermechanismus gepflegt wird, und übergibt sie mit `registry-neutrality-command`. Eine mitgelieferte Kopie wäre eine zweite Quelle der Wahrheit. Dies ist erneut zu prüfen, wenn sich der Kopiermechanismus ändert oder wenn mehr als ein paar Aufrufer abweichen.

## Kein npm-Begleitpaket

Dieses Repository veröffentlicht kein npm-Paket. Die Action ist das Produkt, und das Manifest ist `private`. `scripts/cli.mjs` bietet Maintainern einen lokalen Trockenlauf `resolve` und einen Helfer `check-dist-tags`. Ein Paket wird nur ergänzt, wenn ein Verbraucher außerhalb von GitHub Actions auftaucht.

## Tags

`vX.Y.Z`-Tags markieren Releases. Ein Workflow verschiebt den mitwandernden Tag `v1` nur für das höchste stabile `v1.Y.Z`. Prerelease-Tags verschieben ihn nie.

## Entwicklung

```sh
pnpm install
pnpm test
```

Tests führen die echten Schritt-Skripte gegen Fixture-Pakete aus. `npm` und `pnpm` werden auf `PATH` durch Shims ersetzt, sodass kein Test eine Registry kontaktiert. Golden-Dateien werden nur durch `pnpm run regenerate-goldens` geschrieben, das abgesichert ist.
