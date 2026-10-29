# HagiCode npm publisher

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md)

Une action GitHub composite qui publie des paquets npm depuis le job de l'appelant, via le trusted publishing npm (OIDC). Un seul contrat couvre les releases stables, les publications de développement, les releases multi-paquets et les diagnostics d'échec.

## Pourquoi une action composite

- **Elle s'exécute dans le job de l'appelant.** L'étape de publication utilise le jeton OIDC du job appelant, donc c'est le fichier de workflow de l'appelant qui exécute `npm publish`. La documentation de npm ne traite pas nommément des actions composites ; ce comportement est donc confirmé sur une exécution réelle avant d'être utilisé. Voir [docs/trusted-publishing-notes.md](docs/trusted-publishing-notes.md). Rien ne change sur npmjs.com lorsqu'un dépôt adopte l'action.
- **Un workflow réutilisable changerait l'identité déclarée.** Un workflow réutilisable publie depuis un job appelé. La documentation de npm indique que, pour les workflows réutilisables, la validation vérifie le nom du workflow *appelant*, c'est-à-dire le fichier que l'appelant contrôle déjà. Cette action ne repose pas sur cette règle.
- **Pas de build, pas de dépendances.** Les scripts sont du Node ESM simple, situés sous `scripts/` et exécutés via `${{ github.action_path }}`. Il n'y a pas de `dist/` à committer et rien à installer avant l'exécution des scripts.

## Démarrage rapide

Le job appelant a besoin de `contents: read` et `id-token: write`, et il effectue lui-même le checkout du dépôt. Une action composite ne peut pas définir les permissions du job.

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

Utilisez `@v1` pour la dernière release compatible. Pour un épinglage plus strict, utilisez un SHA de commit complet : `HagiCode-org/hagicode-npm-publisher@<40-character-sha>`.

## Entrées

| Entrée | Par défaut | Description |
| --- | --- | --- |
| `mode` | `auto` | `auto` détecte dev ou release à partir de l'événement. `dev` nécessite un push sur une branche. `release` nécessite une release publiée ou un push de tag stable. |
| `package-manager` | `auto` | `auto` choisit pnpm lorsque `pnpm-lock.yaml` existe dans `working-directory`, sinon npm. `pnpm` ou `npm`. |
| `node-version` | `24` | Version de Node.js pour l'étape de toolchain. |
| `working-directory` | `.` | Répertoire, relatif à la racine du dépôt, qui contient les paquets et le lockfile. |
| `packages` | `.` | Répertoires de paquets séparés par des retours à la ligne, dans l'ordre de publication. Placez les dépendances en premier. |
| `provenance` | `true` | Publier avec `--provenance`. |
| `access` | `public` | Niveau d'accès npm : `public` ou `restricted`. |
| `dist-tag` | `""` | Remplace le dist-tag. Vide signifie `dev` en mode dev et `latest` en mode release. Dev ne peut pas utiliser `latest` ; release doit utiliser `latest`. |
| `registry-url` | `https://registry.npmjs.org` | URL du registre npm. |
| `base-version` | `""` | Base `X.Y.Z` pour les versions de développement. Vide signifie le `X.Y.Z` du `package.json` du premier paquet. |
| `expected-repository` | `""` | `owner/repo` d'où l'exécution doit provenir. Vide signifie le dépôt courant. |
| `expected-workflow` | `.github/workflows/npm-publish.yml` | Fichier de workflow auquel le trusted publisher npm est lié. |
| `install-command` | `auto` | `auto` exécute une installation avec lockfile figé (`pnpm install --frozen-lockfile` ou `npm ci`). Toute autre valeur la remplace. Vide ignore l'installation. |
| `typecheck-command` | `""` | Commande de vérification des types. Vide ignore la gate. |
| `build-command` | `""` | Commande de build. Vide ignore la gate. |
| `test-command` | `""` | Commande de test. Vide ignore la gate. |
| `after-version-command` | `""` | S'exécute après l'application de la version, avec `PUBLISH_VERSION`, `PUBLISH_DIST_TAG` et `PUBLISH_MODE` définis. |
| `registry-neutrality-command` | `""` | Vérification de neutralité du registre gérée par l'appelant. S'exécute après les tests et avant les vérifications de pack. |
| `verify-command` | `""` | Vérification gérée par l'appelant, comme une assertion sur le graphe de paquets. S'exécute avant la publication. |
| `pack-check` | `true` | Exécute `npm pack --dry-run --json` pour chaque paquet et rejette les fichiers qui ont fuité. |
| `verify-package` | `true` | Exécute les règles génériques du manifeste : les points d'entrée existent, et la provenance a une `repository.url` correspondante. |
| `verify-lockfile-stable` | `true` | Échoue si l'installation a modifié le lockfile. Vérifié avec `git diff` par rapport à l'index. |
| `skip-existing` | `true` | Ignore un paquet dont la version résolue existe déjà dans le registre. |
| `summary` | `true` | Écrit le résumé du job. |
| `stamp-release-version` | `false` | Réécrit `package.json` à partir d'un tag stable, au lieu d'exiger qu'il corresponde. |
| `dry-run` | `false` | Exécute toutes les gates jusqu'à la vérification des paquets, sans jamais appeler `npm publish`. |

## Sorties

| Sortie | Description |
| --- | --- |
| `version` | La version résolue (dev ou stable). |
| `dist-tag` | Le dist-tag utilisé. |
| `mode` | `dev` ou `release`. |
| `published` | `true` lorsqu'au moins un paquet a été publié. |
| `published-packages` | Tableau JSON des `name@version` publiés. |
| `skipped-packages` | Tableau JSON des `name@version` ignorés parce que le registre les possédait déjà. |
| `package-manager` | `pnpm` ou `npm`. |

Les sorties sont écrites même lorsque rien n'est publié. Une release brouillon ou de préversion définit `published` à `false` et indique la raison dans le résumé du job.

## Ordre des gates

Les gates s'exécutent dans cet ordre fixe. Tout échec avant la publication arrête l'exécution sans rien publier. Le résumé est écrit même après un échec.

1. Contexte et validation : événement, mode, dépôt et fichier de workflow attendus, version et dist-tag.
2. Toolchain : pnpm (si sélectionné) et Node.js.
3. Installation, puis vérification de la stabilité du lockfile.
4. Application de la version, puis `after-version-command`.
5. Vérification des types, build, test.
6. Commande de neutralité du registre.
7. Vérification du pack, puis vérification du paquet, puis `verify-command`.
8. Publication, paquet par paquet, dans l'ordre indiqué.
9. Résumé.

`dry-run: true` exécute les gates 1 à 7 et n'appelle jamais `npm publish`.

## Contrat de versionnage

### Releases stables

Une release stable est un tag de release `vX.Y.Z` (ou un push de tag `vX.Y.Z`). Les releases brouillon et de préversion ne publient jamais. La version est le tag sans le `v`, et chaque `package.json` listé doit déjà la déclarer. Une incohérence échoue avant l'installation. Avec `stamp-release-version: true`, l'action écrit d'abord la version du tag dans chaque manifeste, pour les appelants qui taguent avant d'incrémenter la version.

Les versions stables sont publiées sur `latest`.

### Versions de développement

Une version de développement a la forme `<base>-dev.<run>.<attempt>.<sha>` :

- `<base>` est `base-version`, ou le `X.Y.Z` de `package.json`.
- `<run>` est `GITHUB_RUN_NUMBER` (par défaut `0`). `<attempt>` est `GITHUB_RUN_ATTEMPT` (par défaut `1`). Les deux doivent être des chiffres sans zéro en tête.
- `<sha>` est `GITHUB_SHA` en minuscules, tous les caractères hors de `[0-9a-z]` étant supprimés, puis tronqué à 7 caractères.
- Il n'y a pas d'horodatage. Le numéro d'exécution et la tentative rendent déjà les versions uniques et ordonnées.

Les versions de développement sont publiées sur `dev`. Elles ne déplacent jamais `latest`.

### La règle du préfixe `g`

Lorsque le SHA nettoyé de 7 caractères ne contient que des chiffres, l'action le préfixe avec `g`. `1234567` devient `g1234567`, et `0123456` devient `g0123456`.

La raison est SemVer. Un identifiant composé uniquement de chiffres est lu comme un nombre. Un zéro en tête rend la version invalide, donc `npm version` refuserait `X.Y.Z-dev.1.1.0123456`. Un SHA court composé uniquement de chiffres serait aussi comparé numériquement plutôt que comme du texte. Environ 3,7 % des SHA hexadécimaux aléatoires de 7 caractères ne contiennent que des chiffres, cela arrive donc lors de vrais pushs.

La règle est obligatoire et testée. Le préfixe est appliqué après la troncature à 7 caractères. Une auto-vérification s'exécute avant toute écriture : la version finale doit être un SemVer valide, et un composant SHA composé uniquement de chiffres sans `g` est refusé.

## Releases multi-paquets et liées

`packages` est l'ordre de publication. L'action ne le trie pas. Chaque paquet reçoit la même version. Les épinglages exacts entre les paquets listés (`"dependency": "0.6.1"`) sont réécrits vers la nouvelle version. Les plages comme `^0.6.0`, `workspace:` et `file:` sont laissées telles quelles, et un avertissement les signale.

Avant de publier chaque paquet, l'action demande au registre ses versions. Une version déjà existante est ignorée et consignée dans `skipped-packages`, ce qui permet de reprendre une relance de release stable. Une erreur `E404` du registre signifie « pas encore de versions ». Toute autre erreur du registre arrête l'exécution, car il n'est jamais sûr de supposer qu'une version est absente.

Le premier échec de publication arrête la boucle. Les paquets suivants ne sont pas tentés, ainsi un paquet dépendant ne part jamais avant sa dépendance.

### Hooks

- `after-version-command` s'exécute après l'application de la version et avant la vérification. Utilisez-le pour une synchronisation gérée par le dépôt, par exemple une version du SDK qui doit correspondre à la version appliquée.
- `verify-command` s'exécute avant la publication. Utilisez-le pour des règles gérées par le dépôt, par exemple une assertion sur le graphe de paquets. Un code de sortie non nul bloque la publication.

## Diagnostic des échecs

Lorsque `npm publish` échoue, l'action conserve la sortie et le code de sortie de npm. Elle affiche ensuite des conseils selon la classe d'échec, construits à partir du nom du paquet, de `GITHUB_REPOSITORY` et du nom du fichier de workflow dans `GITHUB_WORKFLOW_REF`. Les classes sont :

- `E404` : vérifiez que la portée npm existe, que l'identité de publication peut créer le paquet, et que le trusted publisher désigne le bon propriétaire, le bon dépôt, le bon fichier de workflow et le bon environnement.
- `E403` : vérifiez que la version n'est pas déjà publiée et que le trusted publisher autorise cette exécution.
- `E401` / `ENEEDAUTH` : sans les variables OIDC, accordez `id-token: write`. Avec ces variables, vérifiez le trusted publisher.
- `provenance` : comparez `repository.url` dans `package.json` avec le dépôt GitHub.
- `unknown` : une checklist générique.

Les conseils sont écrits sur stderr, dans le résumé du job et sous forme d'une annotation d'erreur. Les jetons sont masqués dans tout ce que l'action affiche.

## Checklist du trusted publisher

Vérifiez ces éléments pour chaque paquet sur npmjs.com. L'action ne modifie pas ces paramètres.

- Owner : le propriétaire GitHub, par exemple `HagiCode-org`.
- Repository : le nom du dépôt GitHub.
- Nom du fichier de workflow : `npm-publish.yml` (ou la valeur de `expected-workflow`).
- Environment : vide, sauf si le job de l'appelant utilise un environnement GitHub et que le trusted publisher le désigne.

Le trusted publishing npm nécessite npm CLI 11.5.1 ou une version ultérieure, et Node.js 22.14.0 ou une version ultérieure. L'action vérifie la version de npm CLI avant de publier et échoue avec des conseils de mise à niveau si la vérification échoue. Node 24 est la valeur par défaut de `node-version`.

## Limitations

- `npm publish` ne réécrit pas les spécificateurs `workspace:`. Les manifestes publiés doivent contenir de vraies plages de versions.
- La version de pnpm provient du champ `packageManager` de `package.json`. Définissez ce champ lorsque `package-manager` se résout en pnpm.
- `npm publish` utilise `cwd` dans le répertoire de chaque paquet, et non `--workspace`. Les dépôts mono-paquet et multi-paquets suivent le même chemin.
- L'action n'exécute pas elle-même de builds ni de tests. Ce sont vos commandes, transmises en entrées.

## Neutralité du registre

La vérification de neutralité du registre n'est pas incluse. Chaque dépôt conserve sa propre copie, maintenue par le mécanisme de copie qu'il utilise déjà, et la transmet avec `registry-neutrality-command`. Une copie embarquée constituerait une seconde source de vérité. Il faudra réexaminer cela lorsque le mécanisme de copie changera, ou lorsque plus de quelques appelants divergeront.

## Aucun paquet npm compagnon

Ce dépôt ne publie aucun paquet npm. L'action est le produit, et le manifeste est `private`. `scripts/cli.mjs` fournit aux mainteneurs une simulation locale `resolve` et un assistant `check-dist-tags`. N'ajoutez un paquet que si un consommateur situé en dehors de GitHub Actions apparaît.

## Tags

Les tags `vX.Y.Z` marquent les releases. Un workflow ne déplace le tag flottant `v1` que pour la plus haute version stable `v1.Y.Z`. Les tags de préversion ne le déplacent jamais.

## Développement

```sh
npm install
npm test
```

Les tests exécutent les véritables scripts d'étape sur des paquets de test. `npm` et `pnpm` sont remplacés par des shims sur `PATH`, donc aucun test ne contacte un registre. Les fichiers de référence (golden) ne sont écrits que par `npm run regenerate-goldens`, qui est protégé.
