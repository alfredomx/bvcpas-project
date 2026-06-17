# mapi_v2 — sistema core + plugins + pipes (LEER PRIMERO)

Primera lectura de cualquier chat sobre `mapi_v2`. Alta señal, bajo contexto. Es el sucesor de `mapi` (que queda **congelado como demo**, no se toca). De `mapi` se **porta** lo bueno, pieza por pieza.

## Qué es

`mapi_v2` se organiza en **tres categorías**:

- **`core/`** — el **substrato mínimo**. Bootea y funciona solo (`GET /v1/healthz`). Provee SOLO lo que plugins y pipes necesitan para interactuar: config (vars del core), db (conexión Postgres compartida), redis, queue (BullMQ), errores/validación/logger, auth slim (token admin) y el **registro** (cómo algo se monta). Nada de dominio.
- **`plugins/<plugin>/`** — una **integración de dominio** (Intuit, banco, uncats, etc.). Cada plugin es **dueño de sus tablas, su config, sus errores, sus rutas y sus migraciones**, y se **inserta** en el core. Le agrega capacidades sin tocarlo.
- **`pipes/<pipe>/`** — un **proceso de fondo sobre BullMQ** (worker que consume/produce una cola). Corre sobre el queue del core. Un pipe puede vivir solo o dentro de un plugin.

Tres propiedades que lo definen:

1. El core arranca solo. Sin plugins ni pipes, igual responde.
2. Un plugin/pipe agrega funcionalidad usando el core, sin modificarlo.
3. Lo quitas del registro → el core sigue intacto. No se entera.

## La regla de oro

**El core NUNCA importa un plugin/pipe por nombre, ni conoce sus tablas, su config ni sus entrañas.** (Eso es lo que rompía `mapi`: `app.module.ts` hardcodeaba cada módulo → todo acoplado.) El core los monta por un **registro**: una lista de **manifiestos uniformes**. El core no sabe qué hace cada uno, solo lo monta y valida.

> **Manifiesto uniforme + validación al boot** (idea robada de [c9/architect](https://github.com/c9/architect)). Cada plugin/pipe exporta una `Unit` con la misma forma: `{ name, kind, module, config }`. El registro es una **lista explícita** (`const REGISTRY: Unit[] = [intuitUnit, ...]`) que al arranque valida la config de cada uno (Zod contra `process.env`) y monta sus módulos. Si falta una env var, **revienta al boot con error claro** (no un 500 misterioso después). NestJS ya da el wiring + fail-fast de dependencias entre servicios; el registro añade la validación de config y la forma común.
>
> **Por qué lista explícita y no auto-discovery (todavía):** el valor está en el **manifiesto uniforme**, no en cómo se descubre. La lista es seguible con ctrl-click y mantiene el core chico. Como el manifiesto ya es uniforme, prender auto-discovery (escanear `plugins/*/` e importar sus `Unit`) después es un cambio de pocas líneas — se hace **cuando un 2º plugin real lo exija**, no antes (mismo principio que el `Connector<T>` de mapi: diferido hasta tener 2 conectores).

## La frontera (motor vs identidad)

- El motor se parametriza por `client`/`realm` que recibe como **input**. NUNCA deriva sobre qué cliente actuar de "el usuario logueado".
- Identidad/tenancy (usuarios, sesiones, multi-cuenta) es **externa y diferida**. Hoy: **un operador único + un token admin**. Mañana: un gateway separado. Construir multiusuario aquí está **prohibido** hasta que se financie.

## Estructura

```
apps/mapi_v2/                 ← el HOST. Aquí viven las deps compartidas + el build.
├── package.json              ← UN solo install / build / start para core + plugins + pipes
├── tsconfig*.json            ← compila core/src + plugins/*/src + pipes/*/src (alias @/ y @plugins/)
├── .env / .prettierrc / eslint.config.mjs
├── node_modules/  dist/      ← (gitignored; un solo node_modules, no uno por módulo)
├── README.md                 ← este archivo (arquitectura, reglas, cómo agregar un plugin/pipe)
├── core/                     ← substrato. Solo código + roadmap (SIN package.json propio).
│   ├── src/
│   │   ├── core/             ← config, db, redis, queue
│   │   ├── common/           ← errores, validación, correlation, auth slim
│   │   ├── registry/         ← monta la lista explícita de units (plugins/pipes)
│   │   └── modules/          ← health
│   └── roadmap/              ← versiones + TDD del core
├── plugins/<plugin>/         ← integración de dominio. Solo código + README + roadmap.
│   ├── src/                  ← su código (core vía servicios inyectados); SUS tablas + SUS migraciones + SU config Zod
│   ├── README.md             ← cara pública: qué hace, in/out, endpoints. NO el cómo.
│   └── roadmap/
└── pipes/<pipe>/             ← worker sobre BullMQ. Mismo formato que un plugin.
```

Build/run: `node dist/core/src/main.js` (el host compila todo a `dist/`). Dev: `npm run start:dev` (tsc-watch).

## Cómo un plugin/pipe se inserta en el core

- Exporta una **`Unit`** (manifiesto uniforme): `{ name, kind: 'plugin'|'pipe', module, config? }`.
  - `module` = un **NestModule** que importa la **API pública del core** (servicios inyectables / tokens DI), nunca el core internals ni otro plugin.
  - `config` = el **Zod de SUS env vars** (el core lo valida al boot; si falta algo, revienta claro).
- El `module` trae **lo suyo**: sus tablas (schema Drizzle + migraciones propias), sus errores (`DomainError` con su `code` + `status`), sus rutas bajo `/v1`, sus colas (`BullModule.registerQueue`).
- El core lo monta agregando la `Unit` a la **lista del registro** (una línea). El core no sabe qué hace; solo valida su config y lo monta.
- Plugins/pipes se comunican entre sí **por cola + contrato** (BullMQ), nunca importándose código.

## Reglas duras (las 5)

1. **Cero reach.** Un plugin/pipe usa la API pública del core + sus propios archivos. NUNCA importa las entrañas del core ni de otro plugin. Lo común se promueve al core **a propósito** (cuando 2 lo necesitan).
2. **Se hablan por cola + contrato**, no por código.
3. **Core flaco.** Solo substrato. Dominio (Intuit, bancos, tokens, clientes) NUNCA va al core.
4. **Tests scoped.** En desarrollo corres solo los tests de tu unidad. Cambias el **core** → core + lo que toca esa superficie. Antes de deploy: corrida completa.
5. **Estado cerrado.** Plugin cerrado = congelado. Su `README.md` (cara pública) es lo único que se lee. Se reabre solo para correcciones.

## Stack y DB

NestJS 11 + BullMQ 5 + Drizzle + ioredis + nestjs-zod + Pino (reusado de mapi, probado).

- **Deps compartidas:** un solo `package.json` + `node_modules` en `apps/mapi_v2/` (sin npm workspaces). El host compila y corre core + plugins + pipes en un solo build. Dev runner: `tsc-watch` (no `nest start` — el layout multi-carpeta no lo permite limpio).
- **El core es dueño de la conexión** a su Postgres propio (`mapi_v2_local` / `mapi_v2_prod`) y de la `DATABASE_URL`.
- **Cada plugin es dueño de SUS tablas, SUS migraciones y SU seed.** El core no define tablas de dominio. (Convención de migraciones por plugin sobre un mismo Postgres: pendiente en BACKLOG, se define con el primer plugin.)

## Unidades (índice)

| Unidad           | Tipo   | Estado | Roadmap                                                                   |
| ---------------- | ------ | ------ | ------------------------------------------------------------------------- |
| `core`           | core   | 🚧     | [core/roadmap/](core/roadmap/README.md)                                   |
| `plugins/intuit` | plugin | 📅     | (primer plugin — lleva qbo-client + tokens + clients + config INTUIT\_\*) |
| `plugins/bank`   | plugin | 📅     | (descarga de banco vía bridge)                                            |
| `plugins/uncats` | plugin | 📅     | (snapshot uncats + respuestas cliente)                                    |

## Cómo arranca un chat por unidad

```
Trabajo en apps/mapi_v2/. Lee:
  1. apps/mapi_v2/README.md                          — esta arquitectura (siempre)
  2. apps/mapi_v2/<core|plugins/X>/roadmap/README.md — proceso + índice + decisiones de la unidad
  3. su vX.Y.Z.md activo (si hay)
Si trabajo un plugin: + apps/mapi_v2/plugins/X/README.md (su cara pública).
NO leas el resto.
```

---

## Plantilla `README.md` (cara pública de un plugin/pipe)

> Al abrir un plugin nuevo, copia esto a `plugins/<plugin>/README.md`. Es la **cara pública**: qué hace y cómo se consume. **NO el cómo interno.** Quien consume el plugin lee SOLO este archivo.
>
> Solo documenta lo que el código NO dice por sí mismo (semántica, in/out, errores). **De qué depende lo dicen los `import` + el `package.json` compartido** — no se lista a mano aquí (mentiría con el tiempo).

```markdown
# <plugin>

## Qué hace (1-2 frases, en términos de talacha)

<Ej: "Descarga cheques/depósitos/estados de un cliente desde el portal del
banco vía el bridge, y los deja en la DB.">

## Estado

`📅 pendiente · 🔬 TDD · 🚧 en construcción · ✅ cerrado/congelado`

## Entradas / Salidas

**Parametrizado por:** `clientId` / `realmId` (input — el motor nunca lo deriva del usuario).

### Endpoints (si expone)

| Método | Ruta        | Qué hace | Auth        |
| ------ | ----------- | -------- | ----------- |
| `POST` | `/v1/<...>` | <...>    | token admin |

### Cola (si produce/consume)

| Cola       | Dirección         | Payload (shape) | Cuándo |
| ---------- | ----------------- | --------------- | ------ |
| `<nombre>` | produce / consume | `{ ... }`       | <...>  |

> Otro plugin que dispare este trabajo publica a esta cola con este shape. No importa el código.

## Errores

| Código         | Status | Caso  |
| -------------- | ------ | ----- |
| `<ERROR_CODE>` | `4xx`  | <...> |

## Usa del core (coarse)

<Piezas del core que consume: db, queue, redis, errores. Intención arquitectónica, no lista de paquetes.>

## NO hace (límites)

<Qué explícitamente queda fuera, para que nadie asuma de más.>
```
