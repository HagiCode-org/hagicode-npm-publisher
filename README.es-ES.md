# HagiCode npm publisher

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md)

Una acción compuesta de GitHub que publica paquetes npm desde el propio job del llamador, mediante la publicación de confianza de npm (OIDC). Un único contrato cubre las versiones estables, las publicaciones de desarrollo, las versiones de varios paquetes y los diagnósticos de fallos.

## Por qué una acción compuesta

- **Se ejecuta dentro del job del llamador.** El paso de publicación usa el token OIDC del job del llamador, de modo que el archivo de workflow del llamador es el que ejecuta `npm publish`. La documentación de npm no menciona las acciones compuestas por nombre, por eso esto se confirma en una ejecución real antes de depender de ello; consulte [docs/trusted-publishing-notes.md](docs/trusted-publishing-notes.md). Nada cambia en npmjs.com cuando un repositorio adopta la acción.
- **Un workflow reutilizable cambiaría quién queda identificado.** Un workflow reutilizable publica desde un job llamado. La documentación de npm indica que, en los workflows reutilizables, la validación comprueba el nombre del workflow *llamador*, es decir, el archivo que el llamador ya controla. Esta acción no depende de esa regla.
- **Sin compilación, sin dependencias.** Los scripts son ESM de Node simple bajo `scripts/`, ejecutados mediante `${{ github.action_path }}`. No hay un `dist/` que confirmar ni nada que instalar antes de ejecutar los scripts.

## Inicio rápido

El job del llamador necesita `contents: read` e `id-token: write`, y hace el checkout del repositorio por sí mismo. Una acción compuesta no puede establecer los permisos del job.

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

Use `@v1` para la versión compatible más reciente. Para fijar la versión de la forma más estricta, use un SHA de commit completo: `HagiCode-org/hagicode-npm-publisher@<40-character-sha>`.

## Entradas

| Entrada | Valor por defecto | Descripción |
| --- | --- | --- |
| `mode` | `auto` | `auto` detecta desarrollo o versión a partir del evento. `dev` necesita un push a una rama. `release` necesita una versión publicada o un push de una etiqueta estable. |
| `package-manager` | `auto` | `auto` elige pnpm cuando existe `pnpm-lock.yaml` en `working-directory`; si no, npm. `pnpm` o `npm`. |
| `node-version` | `24` | Versión de Node.js para el paso de la cadena de herramientas. |
| `working-directory` | `.` | Directorio, relativo a la raíz del repositorio, que contiene los paquetes y el archivo de bloqueo. |
| `packages` | `.` | Directorios de paquetes separados por saltos de línea, en orden de publicación. Coloque primero las dependencias. |
| `provenance` | `true` | Publicar con `--provenance`. |
| `access` | `public` | Nivel de acceso de npm: `public` o `restricted`. |
| `dist-tag` | `""` | Sustituye el dist-tag. Vacío significa `dev` en modo desarrollo y `latest` en modo versión. Dev no puede usar `latest`; release debe usar `latest`. |
| `registry-url` | `https://registry.npmjs.org` | URL del registro de npm. |
| `base-version` | `""` | Base `X.Y.Z` para las versiones de desarrollo. Vacío significa el `X.Y.Z` del `package.json` del primer paquete. |
| `expected-repository` | `""` | `owner/repo` del que debe provenir la ejecución. Vacío significa el repositorio actual. |
| `expected-workflow` | `.github/workflows/npm-publish.yml` | Archivo de workflow al que está vinculado el publicador de confianza de npm. |
| `install-command` | `auto` | `auto` ejecuta una instalación con el archivo de bloqueo congelado (`pnpm install --frozen-lockfile` o `npm ci`). Cualquier otro valor la reemplaza. Vacío omite la instalación. |
| `typecheck-command` | `""` | Comando de comprobación de tipos. Vacío omite el control. |
| `build-command` | `""` | Comando de compilación. Vacío omite el control. |
| `test-command` | `""` | Comando de pruebas. Vacío omite el control. |
| `after-version-command` | `""` | Se ejecuta después de estampar la versión, con `PUBLISH_VERSION`, `PUBLISH_DIST_TAG` y `PUBLISH_MODE` establecidos. |
| `registry-neutrality-command` | `""` | Comprobación de neutralidad del registro a cargo del llamador. Se ejecuta después de las pruebas y antes de las comprobaciones de empaquetado. |
| `verify-command` | `""` | Verificación a cargo del llamador, como una aserción sobre el grafo de paquetes. Se ejecuta antes de publicar. |
| `pack-check` | `true` | Ejecuta `npm pack --dry-run --json` para cada paquete y rechaza los archivos que se hayan filtrado. |
| `verify-package` | `true` | Ejecuta las reglas genéricas del manifiesto: los puntos de entrada existen y la procedencia tiene un `repository.url` que coincide. |
| `verify-lockfile-stable` | `true` | Falla si la instalación modificó el archivo de bloqueo. Se comprueba con `git diff` frente al índice. |
| `skip-existing` | `true` | Omite un paquete cuya versión resuelta ya está en el registro. |
| `summary` | `true` | Escribe el resumen del job. |
| `stamp-release-version` | `false` | Reescribe `package.json` a partir de una etiqueta estable, en lugar de exigir que coincida. |
| `dry-run` | `false` | Ejecuta todos los controles hasta la verificación de paquetes, pero nunca llama a `npm publish`. |

## Salidas

| Salida | Descripción |
| --- | --- |
| `version` | La versión resuelta (de desarrollo o estable). |
| `dist-tag` | El dist-tag utilizado. |
| `mode` | `dev` o `release`. |
| `published` | `true` cuando se publicó al menos un paquete. |
| `published-packages` | Array JSON de `name@version` que se publicaron. |
| `skipped-packages` | Array JSON de `name@version` omitidos porque el registro ya los tenía. |
| `package-manager` | `pnpm` o `npm`. |

Las salidas se escriben incluso cuando no se publica nada. Una versión borrador o preliminar establece `published` en `false` y explica el motivo en el resumen del job.

## Orden de los controles

Los controles se ejecutan en este orden fijo. Cualquier fallo antes de publicar detiene la ejecución sin publicar nada. El resumen se ejecuta incluso después de un fallo.

1. Contexto y validación: evento, modo, repositorio y archivo de workflow esperados, versión y dist-tag.
2. Cadena de herramientas: pnpm (cuando se selecciona) y Node.js.
3. Instalación y, después, la comprobación de estabilidad del archivo de bloqueo.
4. Estampado de la versión y después `after-version-command`.
5. Comprobación de tipos, compilación y pruebas.
6. Comando de neutralidad del registro.
7. Comprobación de empaquetado, después verificación de paquetes y después `verify-command`.
8. Publicación, paquete a paquete en el orden indicado.
9. Resumen.

`dry-run: true` ejecuta los controles 1 a 7 y nunca llama a `npm publish`.

## Contrato de versionado

### Versiones estables

Una versión estable es una etiqueta de versión `vX.Y.Z` (o un push de una etiqueta `vX.Y.Z`). Las versiones borrador y preliminares nunca se publican. La versión es la etiqueta sin `v`, y cada `package.json` listado debe declararla ya. Una discrepancia falla antes de la instalación. Con `stamp-release-version: true`, la acción escribe primero la versión de la etiqueta en cada manifiesto, para los llamadores que etiquetan antes de subir la versión.

Las versiones estables se publican en `latest`.

### Versiones de desarrollo

Una versión de desarrollo tiene la forma `<base>-dev.<run>.<attempt>.<sha>`:

- `<base>` es `base-version`, o el `X.Y.Z` de `package.json`.
- `<run>` es `GITHUB_RUN_NUMBER` (por defecto `0`). `<attempt>` es `GITHUB_RUN_ATTEMPT` (por defecto `1`). Ambos deben ser dígitos sin ceros a la izquierda.
- `<sha>` es `GITHUB_SHA` en minúsculas, eliminando todo carácter fuera de `[0-9a-z]` y recortando después a 7 caracteres.
- No hay marca de tiempo. El número de ejecución y el intento ya hacen que las versiones sean únicas y estén ordenadas.

Las versiones de desarrollo se publican en `dev`. Nunca mueven `latest`.

### La regla del prefijo `g`

Cuando el SHA limpio de 7 caracteres está formado solo por dígitos, la acción le antepone `g`. `1234567` pasa a ser `g1234567`, y `0123456` pasa a ser `g0123456`.

La razón es SemVer. Un identificador formado solo por dígitos se interpreta como un número. Un cero a la izquierda hace que la versión no sea válida, así que `npm version` rechazaría `X.Y.Z-dev.1.1.0123456`. Un SHA corto formado solo por dígitos también se compararía numéricamente en lugar de como texto. Alrededor del 3,7 % de los SHA hexadecimales aleatorios de 7 caracteres están formados solo por dígitos, así que esto ocurre en envíos reales.

La regla es obligatoria y está probada. El prefijo se aplica después de recortar a 7 caracteres. Antes de escribir nada se ejecuta una autocomprobación: la versión final debe ser SemVer válido, y un componente SHA formado solo por dígitos sin `g` se rechaza.

## Versiones de varios paquetes y vinculadas

`packages` es el orden de publicación. La acción no lo ordena. Cada paquete recibe la misma versión. Las fijaciones exactas entre los paquetes listados (`"dependency": "0.6.1"`) se reescriben a la nueva versión. Los rangos como `^0.6.0`, `workspace:` y `file:` no se tocan, y una advertencia los señala.

Antes de publicar cada paquete, la acción consulta al registro sus versiones. Una versión que ya existe se omite y se registra en `skipped-packages`, de modo que una nueva ejecución de una versión estable puede reanudarse. Un `E404` del registro significa «todavía no hay versiones». Cualquier otro error del registro detiene la ejecución, porque nunca es seguro suponer que una versión no existe.

El primer fallo de publicación detiene el bucle. Los paquetes posteriores no se intentan, de modo que un paquete dependiente nunca sale antes que su dependencia.

### Hooks

- `after-version-command` se ejecuta después del estampado y antes de la verificación. Úselo para sincronizaciones propias del repositorio, como una versión del SDK que debe coincidir con la versión estampada.
- `verify-command` se ejecuta antes de publicar. Úselo para reglas propias del repositorio, como una aserción sobre el grafo de paquetes. Una salida distinta de cero bloquea la publicación.

## Diagnóstico de fallos

Cuando `npm publish` falla, la acción conserva la salida y el código de estado de npm. Después imprime orientación para la clase de fallo, construida a partir del nombre del paquete, de `GITHUB_REPOSITORY` y del nombre del archivo de workflow en `GITHUB_WORKFLOW_REF`. Las clases son:

- `E404`: confirme que el ámbito de npm existe, que la identidad que publica puede crear el paquete y que el publicador de confianza indica el propietario, el repositorio, el archivo de workflow y el entorno correctos.
- `E403`: confirme que la versión no está ya publicada y que el publicador de confianza permite esta ejecución.
- `E401` / `ENEEDAUTH`: sin variables OIDC, conceda `id-token: write`. Con ellas, revise el publicador de confianza.
- `provenance`: compare `repository.url` en `package.json` con el repositorio de GitHub.
- `unknown`: una lista de comprobación genérica.

La orientación se escribe en stderr, en el resumen del job y como una anotación de error. Los tokens se ocultan de todo lo que imprime la acción.

## Lista de comprobación del publicador de confianza

Compruebe esto para cada paquete en npmjs.com. La acción no cambia estos ajustes.

- Owner: el propietario de GitHub, por ejemplo `HagiCode-org`.
- Repository: el nombre del repositorio de GitHub.
- Nombre del archivo de workflow: `npm-publish.yml` (o el que indique `expected-workflow`).
- Environment: vacío, a menos que el job del llamador use un entorno de GitHub y el publicador de confianza lo indique.

La publicación de confianza de npm necesita npm CLI 11.5.1 o posterior y Node.js 22.14.0 o posterior. La acción comprueba la versión de npm CLI antes de publicar y falla con instrucciones de actualización si la comprobación no se supera. Node 24 es el valor por defecto de `node-version`.

## Limitaciones

- `npm publish` no reescribe los especificadores `workspace:`. Los manifiestos publicados deben contener rangos de versión reales.
- La versión de pnpm procede del campo `packageManager` de `package.json`. Establezca ese campo cuando `package-manager` resuelva a pnpm.
- `npm publish` usa `cwd` en el directorio de cada paquete, no `--workspace`. Los repositorios de un solo paquete y de varios paquetes siguen el mismo camino.
- La acción no ejecuta por sí misma compilaciones ni pruebas. Esos son sus comandos, pasados como entradas.

## Neutralidad del registro

La comprobación de neutralidad del registro no viene incluida. Cada repositorio mantiene su propia copia, gestionada por el mecanismo de copia que ya utiliza, y la pasa con `registry-neutrality-command`. Una copia incluida sería una segunda fuente de verdad. Revise esto cuando cambie el mecanismo de copia o cuando más de un par de llamadores se desvíen.

## Sin paquete npm complementario

Este repositorio no publica ningún paquete npm. La acción es el producto, y el manifiesto es `private`. `scripts/cli.mjs` ofrece a los mantenedores una simulación local `resolve` y un ayudante `check-dist-tags`. Añada un paquete solo si aparece un consumidor fuera de GitHub Actions.

## Etiquetas

Las etiquetas `vX.Y.Z` marcan las versiones. Un workflow mueve la etiqueta flotante `v1` solo a la `v1.Y.Z` estable más alta. Las etiquetas de versiones preliminares nunca la mueven.

## Desarrollo

```sh
npm install
npm test
```

Las pruebas ejecutan los scripts de paso reales contra paquetes de prueba. `npm` y `pnpm` se sustituyen por shims en `PATH`, así que ninguna prueba contacta con un registro. Los archivos de referencia (golden) solo se escriben con `npm run regenerate-goldens`, que está protegido.
