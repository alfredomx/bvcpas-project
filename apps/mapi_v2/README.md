# mapi_v2 — sistema host + plugins (LEER PRIMERO)

Primera lectura de cualquier chat sobre `mapi_v2`. Alta señal, bajo contexto. Es el sucesor de `mapi` (que queda **congelado como demo**, no se toca). De `mapi` se **porta** lo bueno, pieza por pieza.

## Qué es

`mapi_v2` es un **sistema de plugins**:

- **`core/`** — el sistema base. **Bootea y funciona solo**, sin ningún plugin. Provee la infraestructura: config, db, queue (BullMQ), qbo-client, plugin-bridge, jwt-verify, logger.
- **`plugins/<plugin>/`** — cada plugin hace **una talacha** (descarga de banco, uncats, posting a QBO, etc.) **usando el core**. Le agrega capacidades (endpoints, workers) sin tocarlo.

Tres propiedades que lo definen:

1. El core arranca solo. Sin plugins, igual responde (`GET /v1/healthz`).
2. Un plugin agrega funcionalidad usando el core, sin modificarlo.
3. Quitas el plugin → el core sigue intacto. No se entera.

## La regla de oro

**El core NUNCA importa un plugin por nombre.** (Eso es lo que rompía `mapi`: `app.module.ts` hardcodeaba cada módulo → todo acoplado.) Aquí el core **descubre** los plugins activos por un **registro/manifiesto**; no conoce sus nombres ni sus entrañas. Por eso agregar/quitar un plugin no rompe nada.

## La frontera (motor vs identidad)

- El motor se parametriza por `client`/`realm` que recibe como **input**. NUNCA deriva sobre qué cliente actuar de "el usuario logueado".
- Identidad/tenancy (usuarios, sesiones, multi-cuenta) es **externa y diferida**. Hoy: **un operador único + un token admin**. Mañana: un gateway separado. Construir multiusuario aquí está **prohibido** hasta que se financie.

## Estructura

```
apps/mapi_v2/
├── README.md              ← este archivo (arquitectura, reglas, cómo agregar un plugin)
├── core/                  ← sistema base. Proyecto propio (package.json, src, roadmap).
│   ├── src/
│   │   ├── (infra: config, db, queue, qbo-client, plugin-bridge, jwt-verify, logger)
│   │   └── (plugin-loader: descubre y monta los plugins del registro)
│   └── roadmap/           ← versiones + TDD del core
└── plugins/
    └── <plugin>/          ← una talacha. Proyecto propio.
        ├── src/           ← su código (usa el core vía servicios inyectados)
        ├── CONTRACT.md    ← la cara pública: qué hace, in/out, endpoints. NO el cómo.
        └── roadmap/       ← versiones + TDD del plugin
```

## Cómo un plugin se enchufa al core

- El plugin **importa la API pública del core** (servicios inyectables / tokens DI), nunca el core internals ni otro plugin.
- El core lo monta vía el **registro de plugins** (una línea / un manifiesto). El core no sabe qué hace el plugin, solo lo carga.
- Plugins se comunican entre sí **por cola + contrato** (BullMQ), nunca importándose código.

## Reglas duras (las 5)

1. **Cero reach.** Un plugin usa la API pública del core + sus propios archivos. NUNCA importa las entrañas del core ni de otro plugin. Lo común se promueve al core a propósito.
2. **Plugins se hablan por cola + contrato**, no por código.
3. **Core flaco.** Solo infraestructura. Talacha de dominio NUNCA va al core.
4. **Tests scoped.** En desarrollo corres solo los tests del plugin. Cambias el **core** → core + plugins que tocan esa superficie. Antes de deploy: corrida completa.
5. **Estado cerrado.** Plugin cerrado = congelado. Su `CONTRACT.md` es lo único que se lee. Se reabre solo para correcciones.

## Stack y DB

NestJS 11 + BullMQ 5 + Drizzle + ioredis + nestjs-zod + Pino (reusado de mapi, probado). Mismo tooling. DB propia (`mapi_v2_local` / `mapi_v2_prod`) con seed único de referencia (clientes + credenciales) copiado de mapi: el motor es dueño de su data.

## Unidades (índice)

| Unidad           | Tipo   | Estado | Roadmap                                 |
| ---------------- | ------ | ------ | --------------------------------------- |
| `core`           | base   | 🚧     | [core/roadmap/](core/roadmap/README.md) |
| `plugins/bank`   | plugin | 📅     | (se crea al construirlo)                |
| `plugins/uncats` | plugin | 📅     | (se crea al construirlo)                |

## Cómo arranca un chat por unidad

```
Trabajo en apps/mapi_v2/. Lee:
  1. apps/mapi_v2/README.md                          — esta arquitectura (siempre)
  2. apps/mapi_v2/<core|plugins/X>/roadmap/README.md — proceso + índice + decisiones de la unidad
  3. su vX.Y.Z.md activo (si hay)
Si trabajo un plugin: + apps/mapi_v2/plugins/X/CONTRACT.md.
NO leas el resto.
```

---

## Plantilla `CONTRACT.md` (cara pública de un plugin)

> Al abrir un plugin nuevo, copia esto a `plugins/<plugin>/CONTRACT.md`. Es la **cara pública**: qué hace y cómo se consume. **NO el cómo interno.** Quien consume el plugin lee SOLO este archivo.

```markdown
# <plugin> — CONTRACT

## Qué hace (1-2 frases, en términos de talacha)

<Ej: "Descarga cheques/depósitos/estados de un cliente desde el portal del
banco vía el plugin-bridge, y los deja en la DB.">

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

| Código         | Caso  |
| -------------- | ----- |
| `<ERROR_CODE>` | <...> |

## Depende del core

<Qué piezas del core usa: db, queue, qbo-client, plugin-bridge, encryption, etc.>

## NO hace (límites)

<Qué explícitamente queda fuera, para que nadie asuma de más.>
```
