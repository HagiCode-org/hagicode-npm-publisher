# HagiCode npm publisher

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md)

Uma GitHub Action composta que publica pacotes npm a partir do próprio job do chamador, usando o trusted publishing do npm (OIDC). Um único contrato cobre releases estáveis, publicações de dev, releases com múltiplos pacotes e diagnósticos de falha.

## Por que uma action composta

- **Ela roda dentro do job do chamador.** A etapa de publicação usa o token OIDC do job do chamador, então o arquivo de workflow do próprio chamador é o que executa `npm publish`. A documentação do npm não trata de actions compostas pelo nome, por isso isso é confirmado em uma execução real antes de ser usado; veja [docs/trusted-publishing-notes.md](docs/trusted-publishing-notes.md). Nada no npmjs.com muda quando um repositório adota a action.
- **Um workflow reutilizável mudaria quem é identificado.** Um workflow reutilizável publica a partir de um job chamado. A documentação do npm diz que, para workflows reutilizáveis, a validação verifica o nome do workflow *chamador*, que é o arquivo que o chamador já controla. Esta action não depende dessa regra.
- **Sem build, sem dependências.** Os scripts são Node ESM simples em `scripts/`, executados por meio de `${{ github.action_path }}`. Não há `dist/` para versionar e nada precisa ser instalado antes de os scripts rodarem.

## Início rápido

O job do chamador precisa de `contents: read` e `id-token: write`, e faz o checkout do próprio repositório. Uma action composta não pode definir permissões do job.

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

Use `@v1` para a release compatível mais recente. Para o pin mais restrito, use um SHA completo de commit: `HagiCode-org/hagicode-npm-publisher@<40-character-sha>`.

## Entradas

| Entrada | Padrão | Descrição |
| --- | --- | --- |
| `mode` | `auto` | `auto` detecta dev ou release a partir do evento. `dev` exige um push para uma branch. `release` exige uma release publicada ou um push de tag estável. |
| `package-manager` | `auto` | `auto` escolhe pnpm quando `pnpm-lock.yaml` existe em `working-directory`, caso contrário npm. `pnpm` ou `npm`. |
| `node-version` | `24` | Versão do Node.js para a etapa de toolchain. |
| `working-directory` | `.` | Diretório, relativo à raiz do repositório, que contém os pacotes e o lockfile. |
| `packages` | `.` | Diretórios de pacotes separados por nova linha, na ordem de publicação. Coloque as dependências primeiro. |
| `provenance` | `true` | Publica com `--provenance`. |
| `access` | `public` | Nível de acesso do npm: `public` ou `restricted`. |
| `dist-tag` | `""` | Substitui a dist-tag. Vazio significa `dev` no modo dev e `latest` no modo release. Dev não pode usar `latest`; release deve usar `latest`. |
| `registry-url` | `https://registry.npmjs.org` | URL do registry do npm. |
| `base-version` | `""` | `X.Y.Z` base para versões de dev. Vazio significa o `X.Y.Z` do `package.json` do primeiro pacote. |
| `expected-repository` | `""` | `owner/repo` de onde a execução deve vir. Vazio significa o repositório atual. |
| `expected-workflow` | `.github/workflows/npm-publish.yml` | Arquivo de workflow ao qual o publicador confiável do npm está vinculado. |
| `install-command` | `auto` | `auto` executa uma instalação com lockfile congelado (`pnpm install --frozen-lockfile` ou `npm ci`). Qualquer outro valor a substitui. Vazio pula a instalação. |
| `typecheck-command` | `""` | Comando de verificação de tipos. Vazio pula o gate. |
| `build-command` | `""` | Comando de build. Vazio pula o gate. |
| `test-command` | `""` | Comando de testes. Vazio pula o gate. |
| `after-version-command` | `""` | Executa após a gravação das versões, com `PUBLISH_VERSION`, `PUBLISH_DIST_TAG` e `PUBLISH_MODE` definidos. |
| `registry-neutrality-command` | `""` | Verificação de neutralidade de registry mantida pelo chamador. Executa após os testes e antes das verificações de pack. |
| `verify-command` | `""` | Verificação mantida pelo chamador, como uma asserção sobre o grafo de pacotes. Executa antes da publicação. |
| `pack-check` | `true` | Executa `npm pack --dry-run --json` para cada pacote e rejeita arquivos vazados. |
| `verify-package` | `true` | Executa as regras genéricas do manifesto: os entry points existem, e a proveniência tem um `repository.url` correspondente. |
| `verify-lockfile-stable` | `true` | Falha se a instalação alterou o lockfile. Verificado com `git diff` em relação ao index. |
| `skip-existing` | `true` | Pula um pacote cuja versão resolvida já existe no registry. |
| `summary` | `true` | Grava o resumo do job. |
| `stamp-release-version` | `false` | Reescreve o `package.json` a partir de uma tag estável, em vez de exigir que ele corresponda. |
| `dry-run` | `false` | Executa todos os gates até a verificação dos pacotes, mas nunca chama `npm publish`. |

## Saídas

| Saída | Descrição |
| --- | --- |
| `version` | A versão resolvida (dev ou estável). |
| `dist-tag` | A dist-tag usada. |
| `mode` | `dev` ou `release`. |
| `published` | `true` quando pelo menos um pacote foi publicado. |
| `published-packages` | Array JSON de `name@version` que foram publicados. |
| `skipped-packages` | Array JSON de `name@version` ignorados porque o registry já os tinha. |
| `package-manager` | `pnpm` ou `npm`. |

As saídas são gravadas mesmo quando nada é publicado. Uma release em rascunho ou pré-release define `published` como `false` e explica o motivo no resumo do job.

## Ordem dos gates

Os gates são executados nesta ordem fixa. Qualquer falha antes da publicação interrompe a execução sem publicar. O resumo é executado mesmo após uma falha.

1. Contexto e validação: evento, modo, repositório e arquivo de workflow esperados, versão e dist-tag.
2. Toolchain: pnpm (quando selecionado) e Node.js.
3. Instalação e, em seguida, a verificação de estabilidade do lockfile.
4. Gravação das versões e, em seguida, `after-version-command`.
5. Verificação de tipos, build e testes.
6. Comando de neutralidade de registry.
7. Verificação de pack, depois verificação dos pacotes e, em seguida, `verify-command`.
8. Publicação, pacote por pacote, na ordem listada.
9. Resumo.

`dry-run: true` executa os gates 1 a 7 e nunca chama `npm publish`.

## Contrato de versionamento

### Releases estáveis

Uma release estável é uma tag de release `vX.Y.Z` (ou um push de tag `vX.Y.Z`). Releases em rascunho e pré-releases nunca são publicadas. A versão é a tag sem o `v`, e cada `package.json` listado já deve declará-la. Uma divergência falha antes da instalação. Com `stamp-release-version: true`, a action grava primeiro a versão da tag em cada manifesto, para chamadores que criam a tag antes de incrementar a versão.

Versões estáveis são publicadas em `latest`.

### Versões de dev

Uma versão de dev tem o formato `<base>-dev.<run>.<attempt>.<sha>`:

- `<base>` é o `base-version`, ou o `X.Y.Z` do `package.json`.
- `<run>` é o `GITHUB_RUN_NUMBER` (padrão `0`). `<attempt>` é o `GITHUB_RUN_ATTEMPT` (padrão `1`). Ambos devem ser dígitos sem zeros à esquerda.
- `<sha>` é o `GITHUB_SHA`, em minúsculas, com todo caractere fora de `[0-9a-z]` removido, e depois cortado em 7 caracteres.
- Não há timestamp. O número da execução e a tentativa já tornam as versões únicas e ordenadas.

Versões de dev são publicadas em `dev`. Elas nunca movem `latest`.

### A regra do prefixo `g`

Quando o SHA limpo de 7 caracteres é formado apenas por dígitos, a action adiciona o prefixo `g`. `1234567` vira `g1234567`, e `0123456` vira `g0123456`.

O motivo é o SemVer. Um identificador formado só por dígitos é lido como número. Um zero à esquerda torna a versão inválida, então `npm version` recusaria `X.Y.Z-dev.1.1.0123456`. Um SHA curto formado só por dígitos também seria comparado numericamente, e não como texto. Cerca de 3,7% dos SHAs hexadecimais aleatórios de 7 caracteres são formados só por dígitos, então isso acontece em pushes reais.

A regra é obrigatória e testada. O prefixo é aplicado depois do corte em 7 caracteres. Uma autoverificação roda antes de qualquer gravação: a versão final deve ser um SemVer válido, e um componente de SHA formado só por dígitos sem `g` é recusado.

## Multipacotes e releases vinculados

`packages` é a ordem de publicação. A action não a reordena. Cada pacote recebe a mesma versão. Pins exatos entre os pacotes listados (`"dependency": "0.6.1"`) são reescritos para a nova versão. Intervalos como `^0.6.0`, `workspace:` e `file:` são mantidos, e um aviso os identifica.

Antes de publicar cada pacote, a action consulta o registry sobre as versões dele. Uma versão que já existe é ignorada e registrada em `skipped-packages`, então uma re-execução de release estável pode retomar de onde parou. Um `E404` do registry significa "ainda não há versões". Qualquer outro erro do registry interrompe a execução, porque nunca é seguro presumir que uma versão está ausente.

A primeira falha de publicação interrompe o loop. Os pacotes seguintes não são tentados, então um dependente nunca é publicado antes da sua dependência.

### Hooks

- `after-version-command` executa após a gravação das versões e antes da verificação. Use-o para sincronizações mantidas pelo próprio repositório, como uma versão de SDK que precisa coincidir com a versão gravada.
- `verify-command` executa antes da publicação. Use-o para regras mantidas pelo próprio repositório, como uma asserção sobre o grafo de pacotes. Um código de saída diferente de zero bloqueia a publicação.

## Diagnósticos de falha

Quando `npm publish` falha, a action mantém a saída e o status de saída do npm. Em seguida, imprime orientações para a classe da falha, montadas a partir do nome do pacote, de `GITHUB_REPOSITORY` e do nome do arquivo de workflow em `GITHUB_WORKFLOW_REF`. As classes são:

- `E404`: confirme que o escopo do npm existe, que a identidade de publicação pode criar o pacote e que o publicador confiável indica o dono, o repositório, o arquivo de workflow e o environment corretos.
- `E403`: confirme que a versão ainda não foi publicada e que o publicador confiável permite esta execução.
- `E401` / `ENEEDAUTH`: sem as variáveis OIDC, conceda `id-token: write`. Com elas, verifique o publicador confiável.
- `provenance`: compare o `repository.url` do `package.json` com o repositório do GitHub.
- `unknown`: uma checklist genérica.

As orientações são escritas no stderr, no resumo do job e como uma anotação de erro. Tokens são ocultados de tudo o que a action imprime.

## Checklist do publicador confiável

Verifique estes itens para cada pacote no npmjs.com. A action não altera essas configurações.

- Owner: o dono no GitHub, por exemplo `HagiCode-org`.
- Repository: o nome do repositório no GitHub.
- Workflow filename: `npm-publish.yml` (ou o que `expected-workflow` indicar).
- Environment: vazio, a menos que o job do chamador use um environment do GitHub e o publicador confiável o indique.

O trusted publishing do npm exige npm CLI 11.5.1 ou posterior e Node.js 22.14.0 ou posterior. A action verifica a versão do npm CLI antes de publicar e falha com orientações de atualização caso a verificação não passe. O Node 24 é o padrão de `node-version`.

## Limitações

- Especificadores `workspace:` não são reescritos pelo `npm publish`. Os manifestos publicados devem conter intervalos de versão reais.
- A versão do pnpm vem do campo `packageManager` do `package.json`. Defina esse campo quando `package-manager` resolver para pnpm.
- `npm publish` usa o `cwd` de cada diretório de pacote, e não `--workspace`. Repositórios de pacote único e de múltiplos pacotes compartilham o mesmo caminho.
- A action não executa builds nem testes por conta própria. Esses são os seus comandos, passados como entradas.

## Neutralidade de registry

A verificação de neutralidade de registry não vem incluída. Cada repositório mantém a própria cópia, mantida pelo mecanismo de cópia que já utiliza, e a passa com `registry-neutrality-command`. Uma cópia incluída seria uma segunda fonte de verdade. Reavalie isso quando o mecanismo de cópia mudar ou quando mais de alguns chamadores começarem a divergir.

## Sem pacote npm complementar

Este repositório não publica nenhum pacote npm. A action é o produto, e o manifesto é `private`. `scripts/cli.mjs` oferece aos mantenedores uma simulação local com `resolve` e um auxiliar `check-dist-tags`. Adicione um pacote apenas se surgir um consumidor fora do GitHub Actions.

## Tags

As tags `vX.Y.Z` marcam releases. Um workflow move a tag flutuante `v1` apenas para a maior versão estável `v1.Y.Z`. Tags de pré-release nunca a movem.

## Desenvolvimento

```sh
pnpm install
pnpm test
```

Os testes executam os scripts reais das etapas contra pacotes de fixture. `npm` e `pnpm` são substituídos por shims no `PATH`, então nenhum teste acessa um registry. Os arquivos golden são gravados somente pelo `pnpm run regenerate-goldens`, que é protegido.
