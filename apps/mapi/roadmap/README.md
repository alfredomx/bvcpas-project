# Roadmap — `mapi` (backend NestJS)

Plan y estado de cada módulo y versión de `mapi` dentro de `bvcpas-project`. Estructura: una **carpeta por módulo** (numerada `NN-nombre`) con su `README.md` (TDD vivo del módulo) + uno o varios archivos `vX.Y.Z.md` (bitácora de cada versión que lo construyó). Es la **fuente de verdad** para qué se hizo, qué se está haciendo y qué falta.

> **Si eres un modelo (Claude u otro) iniciando sesión nueva sobre el backend**: lee este README + el TDD del módulo en estado `🚧` (si hay) + el `vX.Y.Z.md` activo + `README.md` raíz del repo.

> **Items diferidos**: ver [`BACKLOG.md`](BACKLOG.md). Es la fuente única donde están las cosas pospuestas, agrupadas por trigger de retomar.

> **Roadmap de los otros apps**: cada app de `bvcpas-project` versiona independiente.
>
> - Frontend: [`../../bvcpas/roadmap/`](../../bvcpas/roadmap/README.md)
> - Plugin Chrome: [`../../kiro/roadmap/`](../../kiro/roadmap/README.md)

---

## Estado actual

**Módulo activo:** `20-intuit-oauth` 🚧 (v0.3.0 cerrada, v0.3.1 pendiente).
**Próximas versiones planeadas:**

- `mapi-v0.3.1` — migración 77 clientes desde mapi v0.x prod + local.

> **Producto, filosofía y plan Mx:** ver [`docs/README.md`](../../../docs/README.md) (cross-app).

---

## Estructura de la carpeta

```
apps/mapi/roadmap/
├── README.md                       ← este archivo (índice + reglas + tabla decisiones)
├── BACKLOG.md                      ← items diferidos por trigger
├── 00-foundation/                  ← bootstrap/infra ✅ v0.1.0
│   ├── README.md
│   └── v0.1.0.md
├── 10-core-auth/                   ← (futuro: cuando un módulo lo pida)
├── 11-clients/                     ← CRUD base + config por cliente (M1 lo extiende)
│   └── README.md
├── 20-intuit-oauth/                ← P1 — OAuth + tokens + refresh + proxy V3
│   ├── README.md                   ← TDD vivo
│   ├── v0.3.0.md                   ← schema + endpoints
│   └── v0.3.1.md                   ← migración 77 clientes
├── 21-intuit-bridge/               ← P2 — WebSocket gateway con plugin (futuro)
├── 22-connectors/                  ← qbo-dev + qbo-internal (cuando un Mx lo pida)
├── 25-dropbox-watcher/             ← M4 + M5 — connector Dropbox (cuando entren)
├── 30-staging/                     ← (cuando un módulo concreto lo pida)
├── 40-classification/              ← M2 opcional + futuros — categorización ML
├── 50-features/                    ← Etapa 1 — features cross-cutting de los GS
│   ├── README.md                   ← TDD del bloque
│   ├── m1-admin/                   ← M1
│   ├── m2-uncats/                  ← M2
│   ├── m3-customer-support/        ← M3
│   ├── m4-stmts-recon/             ← M4
│   ├── m5-receipts/                ← M5
│   ├── m6-form-1099/               ← M6
│   └── m7-w9/                      ← M7
├── 60-posting-qbo/                 ← M2 backend (escritura QBO via plugin)
├── 95-event-log/                   ← (cuando entre auditoría real)
└── 96-admin-jobs/                  ← (cuando entre BullMQ dashboard)
```

### Numeración 1:1 con `src/modules/`

Cada carpeta `NN-nombre` aquí tiene contraparte `apps/mapi/src/modules/NN-nombre/` (excepto `00-foundation` que es infra cross-cutting). Numeración heredada de mapi v0.x (D-mapi-008):

| Decena | Dominio                                                                         |
| ------ | ------------------------------------------------------------------------------- |
| 0x     | Infra/bootstrap (`00-foundation`)                                               |
| 1x     | Core (`10-core-auth`, `11-clients`)                                             |
| 2x     | Integraciones externas (`20-intuit-oauth`, `21-intuit-bridge`, `22-connectors`) |
| 3x     | Datos (`30-staging`)                                                            |
| 4x     | Libre (probable: classification / ML)                                           |
| 5x     | Libre                                                                           |
| 6x     | Libre (probable: posting)                                                       |
| 7x     | Libre (probable: closing / reporting)                                           |
| 9x     | Transversales (`95-event-log`, `96-admin-jobs`)                                 |

**Unidades dejan hueco** para insertar módulos relacionados sin renombrar (ej. `12-permissions` entre `11-clients` y `20-intuit-oauth`).

---

## Versionado SemVer

Versiones siguen [SemVer](https://semver.org/lang/es/):

- `MAJOR.MINOR.PATCH` — `0.2.0`, `1.2.5`, etc.
- **MAJOR** — cambios incompatibles. No hay v1.0.0 todavía.
- **MINOR** — feature nueva, módulo nuevo, refactor grande.
- **PATCH** — fix bloqueante o ajuste pequeño que no agrega features.

**Las versiones son por app, no por módulo.** Cada `vX.Y.Z` solo existe **una vez** en todo el roadmap del app, dentro de la carpeta del módulo principal de esa versión. La tabla cronológica de abajo confirma qué archivo vive en qué carpeta para evitar duplicados.

---

## Estados posibles

| Emoji | Estado       | Significado                                                        |
| ----- | ------------ | ------------------------------------------------------------------ |
| ✅    | Completado   | Módulo o versión cerrada, en main, taggeada en git                 |
| 🚧    | En progreso  | Trabajo activo. **Solo una versión `🚧` a la vez en todo el app.** |
| 🔬    | En discusión | TDD del módulo en revisión, sin abrir versión todavía              |
| 📅    | Planeado     | Existe el archivo pero el trabajo no ha empezado                   |
| ⏸️    | Pausado      | Empezó pero se detuvo (rara vez se usa, requiere nota)             |

---

## Cómo planear una versión nueva

1. **Identifica el módulo principal** de la versión. Si no existe, créalo (`apps/mapi/roadmap/NN-nombre/README.md` con el TDD).
2. **Decide el número de versión** consultando la tabla cronológica de abajo. El siguiente número libre.
3. **Crea el archivo** `apps/mapi/roadmap/NN-nombre/vX.Y.Z.md` usando la plantilla.
4. **NO bumpees `apps/mapi/package.json` todavía.** Eso pasa al cerrar la versión.
5. **Marca como `🚧 En progreso`** y agrega entrada al índice de este README + a la tabla del TDD del módulo.
6. **Cierra primero la versión que estaba `🚧`** (commitea, taggea, marca ✅) antes de empezar otra.

### Plantilla de versión (`vX.Y.Z.md`)

```markdown
# vX.Y.Z — [Título corto descriptivo]

**Estado**: 🚧 En progreso
**Inicio**: YYYY-MM-DD
**Cierre estimado**: YYYY-MM-DD
**Módulo**: NN-nombre
**TDD ref**: [README.md](README.md)

## Alcance

### Sí entra

- Subset concreto de las tareas del TDD del módulo que esta versión va a cerrar.

### NO entra (fuera de alcance)

- Tareas del TDD que se difieren a versiones posteriores.

## Eventos a agregar (event_log)

> **Sección obligatoria.** Si no aplica, escribir "Ninguno" — pero NO omitir.

- [ ] `<event.type>` — payload: `{ ... }`. Disparado en `<service>.<method>`.
      Razón: <por qué amerita registro permanente vs solo Loki>.

## Errores de dominio nuevos

> **Sección obligatoria.** Si no aplica, escribir "Ninguno". Recuerda mapearlos en `src/common/errors/domain-error.filter.ts` con HTTP status.

- [ ] `<NombreError>` (HTTP <status>): `<código_string>`. Origen.

## Endpoints API nuevos

> **Sección obligatoria.** Si no aplica, escribir "Ninguno". Aplicar reglas DOC-X (ApiTags, ApiOperation, ApiResponse con DTO Zod).

- [ ] `<METHOD> /v1/<path>` — qué hace. DTO request: <X>. DTO response: <Y>.

## TODOs

- [ ] Tarea 1 (la más pequeña que tiene sentido revisar sola)
- [ ] Tarea 2
- [ ] Bumpear `apps/mapi/package.json` a vX.Y.Z
- [ ] Commit + push + tag `mapi-vX.Y.Z`

## Decisiones tomadas durante esta versión

- **D-mapi-NNN** — [Título de la decisión]
  - Diverge del TDD: sí/no
  - Razón:
  - Consecuencia:

## Fixes durante desarrollo

- [ ] Fix cosmético encontrado mientras se trabajaba.

## Notas operativas

- Algo que recordar pero sin tarea concreta.
```

---

## Cómo manejar fixes

Regla: **¿este bug bloquea?** → patch (`vX.Y.Z+1`). **¿Puede esperar?** → sección `## Fixes durante desarrollo` del archivo activo. **¿Lo descubrí mientras hacía el feature?** → es trabajo del feature, no fix.

**Hotfix urgente — proceso completo:**

1. Si tienes una versión `🚧` activa, **pausa**: agrega nota en su archivo "pausado por hotfix vX.Y.Z+1".
2. Crea `vX.Y.Z+1.md` (patch) en la carpeta del módulo donde nació el bug. Solo un TODO o dos.
3. Aplica fix, prueba, commitea, push, tag.
4. Cierra el archivo del patch como `✅`.
5. Reanuda la versión que estaba `🚧`.

---

## Decisiones que divergen del TDD

Cada decisión no trivial se numera global por app: `D-mapi-001`, `D-mapi-002`, ..., `D-mapi-NNN`. Vive **en el archivo de la versión donde se tomó** + se agrega al índice global de decisiones de este README.

**Qué es decisión y qué no:**

- ✅ Sí: "usamos puerto 4100 en lugar de lo que dice el TDD" → D-mapi-XXX
- ✅ Sí: "no implementamos `--role` flag aunque el TDD lo menciona" → D-mapi-XXX
- ❌ No: "elegimos `bcrypt 6.0.0` porque es la última estable" → no decision, normal
- ❌ No: "renombramos un archivo" → trabajo del feature

Si dudas: si imaginas que en 6 meses alguien lee el código y se pregunta "¿por qué hicieron esto y no lo del TDD?" → es decisión, documéntala.

---

## Cómo cerrar una versión

Cuando todos los TODOs estén `[x]` y todo esté en main:

1. Marca el archivo como `✅ Completado`. Cambia "Cierre estimado" por "Cerrado: YYYY-MM-DD".
2. Bumpea `apps/mapi/package.json` `version` al número de la versión.
3. Actualiza la tabla cronológica de versiones de este README con `✅`.
4. Si hubo decisiones nuevas, agrégalas a la tabla de decisiones de este README.
5. Si la versión cerró el módulo entero, marca el módulo como `✅` en su `README.md` y en el índice de módulos de este README.
6. Commit con mensaje `release(mapi): vX.Y.Z — [título]`.
7. Push a `main`.
8. Tag git: `git tag mapi-vX.Y.Z && git push --tags` (prefijo `mapi-` evita choque con tags de los otros apps).

---

## Reglas duras (no negociables)

1. **Solo una versión `🚧` a la vez en todo el app.** Excepción: hotfix urgente que pausa la activa.
2. **No bumpees `apps/mapi/package.json` hasta cerrar.**
3. **No mezcles features y fixes mayores en la misma versión.**
4. **El TDD manda salvo decisión documentada.**
5. **Eventos event_log, errores de dominio y endpoints API son secciones obligatorias** del archivo de versión.
6. **Tags git con prefijo `mapi-`** (`mapi-v0.2.0`).
7. **Cada commit toca un solo app y solo cosas relacionadas con la versión activa.** No mezclar fixes "de paso" en otros apps.
8. **Numeración 1:1 con `src/modules/`.** Cuando un módulo nuevo entre, asignar número siguiendo la regla de decenas.

---

## Índice de módulos

| Carpeta                         | Status | Mx      | TDD                                                    | Versiones                                          |
| ------------------------------- | ------ | ------- | ------------------------------------------------------ | -------------------------------------------------- |
| 00-foundation                   | ✅     | P0      | [README.md](00-foundation/README.md)                   | [v0.1.0](00-foundation/v0.1.0.md)                  |
| 10-core-auth                    | ✅     | base    | [README.md](10-core-auth/README.md)                    | [v0.2.0](10-core-auth/v0.2.0.md)                   |
| 11-clients                      | 📅     | base+M1 | [README.md](11-clients/README.md)                      | (cubierto en 20-intuit-oauth v0.3.0)               |
| 20-intuit-oauth                 | 🚧     | P1      | [README.md](20-intuit-oauth/README.md)                 | [v0.3.0](20-intuit-oauth/v0.3.0.md) ✅ + v0.3.1 📅 |
| 21-intuit-bridge                | 📅     | P2      | (futuro)                                               | —                                                  |
| 22-connectors                   | 📅     | —       | (futuro: qbo-dev + qbo-internal)                       | —                                                  |
| 50-features/m1-admin            | 📅     | M1      | [README.md](50-features/m1-admin/README.md)            | —                                                  |
| 50-features/m2-uncats           | 📅     | M2      | [README.md](50-features/m2-uncats/README.md)           | —                                                  |
| 50-features/m3-customer-support | 📅     | M3      | [README.md](50-features/m3-customer-support/README.md) | —                                                  |
| 50-features/m4-stmts-recon      | 📅     | M4      | [README.md](50-features/m4-stmts-recon/README.md)      | —                                                  |
| 50-features/m5-receipts         | 📅     | M5      | [README.md](50-features/m5-receipts/README.md)         | —                                                  |
| 50-features/m6-form-1099        | 📅     | M6      | [README.md](50-features/m6-form-1099/README.md)        | —                                                  |
| 50-features/m7-w9               | 📅     | M7      | [README.md](50-features/m7-w9/README.md)               | —                                                  |

---

## Versiones (orden cronológico)

| Versión | Módulo          | Estado | Tema                                                                          | Tag         | Archivo                                                |
| ------- | --------------- | ------ | ----------------------------------------------------------------------------- | ----------- | ------------------------------------------------------ |
| 0.1.0   | 00-foundation   | ✅     | Bootstrap NestJS + core + DB/Health + Metrics/Scalar + deploy Coolify         | mapi-v0.1.0 | [00-foundation/v0.1.0.md](00-foundation/v0.1.0.md)     |
| 0.2.0   | 10-core-auth    | ✅     | Auth (users + JWT + sesiones revocables + admin CRUD)                         | mapi-v0.2.0 | [10-core-auth/v0.2.0.md](10-core-auth/v0.2.0.md)       |
| 0.3.0   | 20-intuit-oauth | ✅     | Schema clients + intuit_tokens + 6 endpoints OAuth + proxy V3 + cron métricas | mapi-v0.3.0 | [20-intuit-oauth/v0.3.0.md](20-intuit-oauth/v0.3.0.md) |

---

## Decisiones acumuladas (`D-mapi-NNN`)

| ID         | Decisión                                                                                                | Versión | Diverge TDD |
| ---------- | ------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| D-mapi-001 | `tsc + tsc-alias` directo, sin `nest build` (heredado de mapi v0.x D-071)                               | 0.1.0   | No          |
| D-mapi-002 | Prefijo `/v1` con exclude `metrics` (Prometheus convención mundial)                                     | 0.1.0   | No          |
| D-mapi-003 | `cleanupOpenApiDoc` de nestjs-zod (en lugar de `patchNestjsSwagger` que no existe en v5)                | 0.1.0   | No          |
| D-mapi-004 | Scalar `layout: 'modern'` + `hideModels: true` para evitar Models en sidebar                            | 0.1.0   | No          |
| D-mapi-005 | Schema env vars con `emptyToUndefined` preprocess (vars vacías en `.env` no rompen `.optional()`)       | 0.1.0   | No          |
| D-mapi-006 | DbModule `@Global()` con tokens `DB` (drizzle) y `DB_CLIENT` (postgres-js raw); shutdown timeout 5s     | 0.1.0   | No          |
| D-mapi-007 | Subdominio prod = `mapi.kodapp.com.mx` (legacy mapi v0.x sigue en `mapi.alfredo.mx` durante transición) | 0.1.0   | No          |
| D-mapi-008 | Numeración 1:1 entre `src/modules/NN-nombre/` y `roadmap/NN-nombre/` (heredado de mapi v0.x D-027)      | —       | No          |
| D-mapi-009 | Scripts CLI (migrate.ts, seed-admin.ts) NO se compilan al `dist/` (solo se corren con `tsx`)            | 0.2.0   | No          |
| D-mapi-010 | `src/modules/auth/` → `src/modules/10-core-auth/`, `event-log/` → `95-event-log/`. health sin prefijo.  | 0.2.0   | No          |

---

## Onboarding rápido para sesión nueva

```
Trabajo en d:/proyectos/bvcpas-project/apps/mapi/. Lee en orden:
  1. apps/mapi/roadmap/README.md                   — proceso, índice, decisiones
  2. apps/mapi/roadmap/<NN-modulo>/README.md       — TDD del módulo activo
  3. apps/mapi/roadmap/<NN-modulo>/vX.Y.Z.md       — versión 🚧 (si hay)
  4. README.md raíz                                 — cómo correr el proyecto
  5. apps/mapi/roadmap/BACKLOG.md                  — items diferidos por trigger

Mi siguiente tarea es: [describe qué quieres hacer].
```
