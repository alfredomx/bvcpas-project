# Roadmap — `bvcpas` (frontend Next.js)

Plan y estado de cada módulo y versión de `bvcpas` dentro de
`bvcpas-project`. Estructura: una **carpeta por módulo** (numerada
`NN-nombre`) con su `README.md` (TDD vivo del módulo) + uno o varios
archivos `vX.Y.Z.md` (bitácora de cada versión que lo construyó). Es
la **fuente de verdad** para qué se hizo, qué se está haciendo y qué
falta.

> **Si eres un modelo (Claude u otro) iniciando sesión nueva sobre el
> frontend**: lee este README + el TDD del módulo en estado `🚧` (si
> hay) + el `vX.Y.Z.md` activo + [`CONVENTIONS.md`](CONVENTIONS.md).

> **Items diferidos**: ver [`BACKLOG.md`](BACKLOG.md). Es la fuente
> única donde están las cosas pospuestas, agrupadas por trigger
> de retomar.

> **Roadmap de los otros apps**: cada app de `bvcpas-project` versiona
> independiente.
>
> - Backend: [`../../mapi/roadmap/`](../../mapi/roadmap/README.md)

---

## Estado actual

**Módulos activos:**

- `00-foundation` ✅ (v0.1.0 + v0.3.2 — scaffold + SDK tipado).
- `10-core-auth` ✅ (v0.2.0 + v0.2.1 — login + tests).
- `11-clients` ✅ (v0.4.0 — `listClients` + `useClients` vía SDK tipado consumiendo `GET /v1/clients`).
- `12-customer-support` ✅ (v0.5.0 — header + stats + suggested + quick links + activity timeline consumiendo `/v1/clients/:id/uncats`).
- `13-dashboards` ✅ (v0.5.0 — primera view real `uncats-detail`).
- `15-app-shell` ✅ (v0.3.0 + v0.3.1 + v0.4.0 — AppShell + sidebar reapuntada a `useClients` en v0.4.0; v0.3.1 strippeó diseño cosmético).

**Política de testing** (desde v0.3.0): TDD-first. Tests antes que
código. Ver [CONVENTIONS.md §12](CONVENTIONS.md#12-testing).

**Próximas versiones planeadas:**

- v0.5.1 — Tabla Uncategorized / AMA's en la tab Customer Support
  (módulo `14-transactions` consumiendo `GET /v1/clients/:id/transactions`).
- v0.6.0+ — Migración de `useSession` al SDK tipado + borrado de
  `@/lib/http.ts` (cierra D-bvcpas-025).
- v0.7.0+ — Tabs adicionales conforme mapi exponga views
  (Reconciliations, W-9, 1099, Mgt Report, Tax Packet, QTR Payroll,
  Property Tax).

---

## Estructura de la carpeta

```
apps/bvcpas/roadmap/
├── README.md                  ← este archivo (índice + reglas + decisiones)
├── BACKLOG.md                 ← items diferidos por trigger
├── 00-foundation/             ← scaffold base ✅ v0.1.0
│   ├── README.md
│   └── v0.1.0.md
├── 10-core-auth/              ← login + sesión + guard 🚧
│   ├── README.md
│   └── v0.2.0.md
├── 11-clients/                ← (futuro: lista en sidebar, detalle)
├── 12-customer-support/       ← (futuro: tab Customer Support)
├── 13-dashboards/             ← (futuro: detalle de cliente con KPIs)
└── 15-app-shell/              ← AppShell + sidebar + topbar + avatar 📅
    └── README.md
```

### Numeración 1:1 con `src/modules/`

Cada carpeta `NN-nombre` aquí tiene contraparte
`apps/bvcpas/src/modules/NN-nombre/`. Bandas de numeración (ver
[CONVENTIONS.md §2](CONVENTIONS.md#2-módulos-srcmodulesnn-name)):

| Banda    | Significado                                                       | Match con mapi                   |
| -------- | ----------------------------------------------------------------- | -------------------------------- |
| `00`     | Foundation / scaffold base                                        | Sí (`00-foundation`)             |
| `10–14`  | Núcleo del dominio                                                | Sí (espejo 1:1 cuando hay match) |
| `15–19`  | UI shell / cross-cutting solo-frontend                            | No existe en mapi                |
| `20–29`  | Integraciones con terceros (cuando entren)                        | Sí (espejo)                      |
| `90–99`  | Infraestructura transversal / observabilidad                      | Sí (espejo)                      |
| Sin pref | Utilidades de plataforma cross-cutting (`lib/`, `components/ui/`) | —                                |

**Unidades dejan hueco** para insertar módulos relacionados sin
renombrar.

---

## Versionado SemVer

Versiones siguen [SemVer](https://semver.org/lang/es/):

- `MAJOR.MINOR.PATCH` — `0.2.0`, `1.2.5`, etc.
- **MAJOR** — cambios incompatibles. No hay v1.0.0 todavía.
- **MINOR** — feature nueva, módulo nuevo, refactor grande.
- **PATCH** — fix bloqueante o ajuste pequeño que no agrega features.

**Las versiones son por app, no por módulo.** Cada `vX.Y.Z` solo
existe **una vez** en todo el roadmap del app, dentro de la carpeta
del módulo principal de esa versión.

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

1. **Identifica el módulo principal** de la versión. Si no existe,
   créalo (`apps/bvcpas/roadmap/NN-nombre/README.md` con el TDD).
2. **Decide el número de versión** consultando la tabla cronológica de
   abajo. El siguiente número libre.
3. **Crea el archivo** `apps/bvcpas/roadmap/NN-nombre/vX.Y.Z.md` usando
   la plantilla.
4. **NO bumpees `apps/bvcpas/package.json` todavía.** Eso pasa al
   cerrar la versión.
5. **Marca como `🚧 En progreso`** y agrega entrada al índice de este
   README + a la tabla del TDD del módulo.
6. **Cierra primero la versión que estaba `🚧`** (commitea, taggea,
   marca ✅) antes de empezar otra.

### Plantilla de versión (`vX.Y.Z.md`)

```markdown
# vX.Y.Z — [Título corto descriptivo]

**Estado**: 🚧 En progreso
**Inicio**: YYYY-MM-DD
**Cierre estimado**: YYYY-MM-DD
**Módulo principal**: NN-nombre
**TDD ref**: [README.md](README.md)

## Objetivo

## Alcance

### Sí entra

### NO entra

## Eventos a agregar (event_log)

> **Sección obligatoria.** En frontend siempre escribir "Ninguno" — el
> frontend no emite eventos al backend. Pero NO omitir.

## Errores de dominio nuevos

> **Sección obligatoria.** En frontend listar el mapeo
> `code de mapi → mensaje en UI`. Si no hay errores nuevos consumidos,
> escribir "Ninguno".

## Endpoints API nuevos

> **Sección obligatoria.** En frontend listar los endpoints de mapi
> que la versión consume. Si la versión no consume ninguno, escribir
> "Ninguno".

## Flujo

## Pre-requisitos para arrancar

## TODOs (orden TDD-first, secuencial)

## Decisiones tomadas durante esta versión

- **D-bvcpas-NNN** — [Título de la decisión]
  - Diverge del TDD: sí/no
  - Razón:
  - Consecuencia:

## Fixes durante desarrollo

## Smoke test del módulo

## Notas operativas
```

---

## Cómo manejar fixes

Regla: **¿este bug bloquea?** → patch (`vX.Y.Z+1`). **¿Puede esperar?**
→ sección `## Fixes durante desarrollo` del archivo activo. **¿Lo
descubrí mientras hacía el feature?** → es trabajo del feature, no fix.

**Hotfix urgente — proceso completo:**

1. Si tienes una versión `🚧` activa, **pausa**: agrega nota en su
   archivo "pausado por hotfix vX.Y.Z+1".
2. Crea `vX.Y.Z+1.md` (patch) en la carpeta del módulo donde nació
   el bug. Solo un TODO o dos.
3. Aplica fix, prueba, commitea, push, tag.
4. Cierra el archivo del patch como `✅`.
5. Reanuda la versión que estaba `🚧`.

---

## Decisiones que divergen del TDD

Cada decisión no trivial se numera global por app:
`D-bvcpas-001`, `D-bvcpas-002`, ..., `D-bvcpas-NNN`. Vive **en el
archivo de la versión donde se tomó** + se agrega al índice global de
decisiones de este README cuando la versión cierra.

**Qué es decisión y qué no:**

- ✅ Sí: "elegimos sessionStorage en lugar de localStorage" → D-bvcpas-XXX
- ✅ Sí: "wrapper fetch propio en lugar de ofetch/ky" → D-bvcpas-XXX
- ❌ No: "elegimos `react-hook-form` porque es estándar en shadcn" — no
  decision, normal.
- ❌ No: "renombramos un archivo" — trabajo del feature.

Si dudas: si imaginas que en 6 meses alguien lee el código y se
pregunta "¿por qué hicieron esto y no lo del TDD?" → es decisión,
documéntala.

---

## Cómo cerrar una versión

Cuando todos los TODOs estén `[x]` y todo esté en main:

1. Marca el archivo como `✅ Completado`. Cambia "Cierre estimado" por
   "Cerrado: YYYY-MM-DD".
2. Bumpea `apps/bvcpas/package.json` `version` al número de la versión.
3. Actualiza la tabla cronológica de versiones de este README con `✅`.
4. Si hubo decisiones nuevas, agrégalas a la tabla de decisiones de
   este README.
5. Si la versión cerró el módulo entero, marca el módulo como `✅` en
   su `README.md` y en el índice de módulos de este README.
6. Commit con mensaje `release(bvcpas): vX.Y.Z — [título]`.
7. Push a `main`.
8. Tag git: `git tag bvcpas-vX.Y.Z && git push --tags` (prefijo
   `bvcpas-` evita choque con tags de los otros apps).

---

## Reglas duras (no negociables)

1. **Solo una versión `🚧` a la vez en todo el app.** Excepción:
   hotfix urgente que pausa la activa.
2. **No bumpees `apps/bvcpas/package.json` hasta cerrar.**
3. **No mezcles features y fixes mayores en la misma versión.**
4. **El TDD manda salvo decisión documentada como `D-bvcpas-NNN`.**
5. **Eventos event_log, errores de dominio y endpoints API son
   secciones obligatorias** del archivo de versión. En frontend casi
   siempre dicen "Ninguno" pero NO se omiten.
6. **Tags git con prefijo `bvcpas-`** (`bvcpas-v0.2.0`).
7. **Cada commit toca un solo app y solo cosas relacionadas con la
   versión activa.** No mezclar fixes "de paso" en otros apps.
8. **Numeración 1:1 con `src/modules/`.** Cuando un módulo nuevo entre,
   asignar número siguiendo la regla de bandas (CONVENTIONS.md §2).

---

## Índice de módulos

| Carpeta             | Status | TDD                                  | Versiones                                                           |
| ------------------- | ------ | ------------------------------------ | ------------------------------------------------------------------- |
| 00-foundation       | ✅     | [README.md](00-foundation/README.md) | [v0.1.0](00-foundation/v0.1.0.md) + [v0.3.2](00-foundation/v0.3.2.md) |
| 10-core-auth        | ✅     | [README.md](10-core-auth/README.md)  | [v0.2.0](10-core-auth/v0.2.0.md) + [v0.2.1](10-core-auth/v0.2.1.md)   |
| 11-clients          | ✅     | [README.md](11-clients/README.md)    | [v0.4.0](11-clients/v0.4.0.md) + [v0.4.1](11-clients/v0.4.1.md)       |
| 12-customer-support | ✅     | [README.md](12-customer-support/README.md) | [v0.5.0](12-customer-support/v0.5.0.md)                         |
| 13-dashboards       | ✅     | [README.md](13-dashboards/README.md)       | (primera view real en v0.5.0; archivo TDD vive en 12-customer-support) |
| 15-app-shell        | ✅     | [README.md](15-app-shell/README.md)  | [v0.3.0](15-app-shell/v0.3.0.md) + [v0.3.1](15-app-shell/v0.3.1.md)   |

---

## Versiones (orden cronológico)

| Versión | Módulo        | Estado | Tema                                                                         | Tag           | Archivo                                            |
| ------- | ------------- | ------ | ---------------------------------------------------------------------------- | ------------- | -------------------------------------------------- |
| 0.1.0   | 00-foundation | ✅     | Scaffold base (Tailwind v4, shadcn, alias `@/*`)                             | bvcpas-v0.1.0 | [00-foundation/v0.1.0.md](00-foundation/v0.1.0.md) |
| 0.2.0   | 10-core-auth  | ✅     | Login real contra mapi + sesión + guard                                      | bvcpas-v0.2.0 | [10-core-auth/v0.2.0.md](10-core-auth/v0.2.0.md)   |
| 0.2.1   | 10-core-auth  | ✅     | Tests retroactivos (Vitest + Testing Library)                                | bvcpas-v0.2.1 | [10-core-auth/v0.2.1.md](10-core-auth/v0.2.1.md)   |
| 0.3.0   | 15-app-shell  | ✅     | AppShell visual + sidebar + tabs + 8 placeholders + diseño 1:1 con prototipo | bvcpas-v0.3.0 | [15-app-shell/v0.3.0.md](15-app-shell/v0.3.0.md)   |
| 0.3.1   | 15-app-shell  | ✅     | Strip de diseño cosmético (D-bvcpas-022)                                     | bvcpas-v0.3.1 | [15-app-shell/v0.3.1.md](15-app-shell/v0.3.1.md)   |
| 0.3.2   | 00-foundation | ✅     | SDK tipado desde OpenAPI (`openapi-typescript` + `openapi-fetch`)            | bvcpas-v0.3.2 | [00-foundation/v0.3.2.md](00-foundation/v0.3.2.md) |
| 0.4.0   | 11-clients    | ✅     | Sidebar consume `/v1/clients` directo + módulo 11-clients real (D-026/027/028) | bvcpas-v0.4.0 | [11-clients/v0.4.0.md](11-clients/v0.4.0.md)       |
| 0.4.1   | 11-clients    | ✅     | Fix sidebar paginación: `pageSize=200` (D-bvcpas-029)                        | bvcpas-v0.4.1 | [11-clients/v0.4.1.md](11-clients/v0.4.1.md)       |
| 0.5.0   | 12-customer-support | ✅ | Tab Customer Support (parte 1: header + stats + timeline) — D-030/031/032 | bvcpas-v0.5.0 | [12-customer-support/v0.5.0.md](12-customer-support/v0.5.0.md) |

---

## Decisiones acumuladas (`D-bvcpas-NNN`)

| ID           | Decisión                                                                                                 | Versión | Diverge TDD |
| ------------ | -------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| D-bvcpas-001 | Cliente HTTP propio (~50 líneas sobre `fetch`), sin `ofetch`/`ky`/`axios`                                | 0.2.0   | No          |
| D-bvcpas-002 | `sessionStorage` (no `localStorage` ni cookie); checkbox "Keep me signed in" eliminado                   | 0.2.0   | No          |
| D-bvcpas-003 | Validar sesión con `GET /v1/auth/me` al montar `(authenticated)/`                                        | 0.2.0   | No          |
| D-bvcpas-004 | `ApiError` como clase JS, no objetos planos ni Result types                                              | 0.2.0   | No          |
| D-bvcpas-005 | Form con `react-hook-form` + `zod` + shadcn `<Form>`                                                     | 0.2.0   | No          |
| D-bvcpas-006 | Evento DOM `auth:unauthorized` para cerrar sesión global ante 401                                        | 0.2.0   | No          |
| D-bvcpas-007 | ~~Sin tests automatizados~~ — REVERTIDA por D-bvcpas-011                                                 | 0.2.0   | No          |
| D-bvcpas-008 | Login vive en `/` (`src/app/page.tsx`), no en `/login`. La ruta `/login` no existe                       | 0.2.0   | Sí          |
| D-bvcpas-009 | Sistema de tokens semánticos centralizado en `globals.css`; prohibido usar colores literales             | 0.2.0   | Sí          |
| D-bvcpas-010 | `useSession` como Context global (`<SessionProvider>`), no hook con estado local por instancia           | 0.2.0   | Sí          |
| D-bvcpas-011 | Adopción de testing (Vitest + Testing Library + JSDOM); TDD-first desde v0.3.0. Revierte D-bvcpas-007    | 0.2.1   | Sí          |
| D-bvcpas-012 | Extracción de `mapErrorMessage` a `lib/map-error-message.ts` para testabilidad                           | 0.2.1   | Sí          |
| D-bvcpas-013 | `vitest.config.mts` (no `.ts`) por compat ESM con `vite-tsconfig-paths`; `esbuild.jsx='automatic'`       | 0.2.1   | No          |
| D-bvcpas-014 | Adopción de React Query (`@tanstack/react-query`); `<QueryProvider>` en root layout                      | 0.3.0   | Sí          |
| D-bvcpas-015 | Sidebar consume `GET /v1/dashboards/customer-support` (no `GET /v1/clients`) por tener stats             | 0.3.0   | Sí          |
| D-bvcpas-016 | Virtualización con `@tanstack/react-virtual` desde día 1, aunque sean <100 clientes                      | 0.3.0   | No          |
| D-bvcpas-017 | `/dashboard` muestra empty state, NO auto-select del primer cliente                                      | 0.3.0   | No          |
| D-bvcpas-018 | Customer Support tab también es placeholder en v0.3.0; pantalla real entra en v0.4.0                     | 0.3.0   | Sí          |
| D-bvcpas-019 | Política de branches: `<app>/<NN-modulo>` sin versión; tag `<app>-vX.Y.Z`. Convención unificada con mapi | 0.3.0   | Sí          |
| D-bvcpas-020 | Naming campos: snake_case 1:1 con backend; sin adapters camelCase                                        | 0.3.0   | Sí          |
| D-bvcpas-021 | Aliases shadcn dentro de `@theme` con prefijo `--color-*` (no en `:root` plano) — Tailwind v4            | 0.3.0   | Sí          |
| D-bvcpas-022 | Strip de diseño cosmético antes de rediseñar desde cero — sólo aliases shadcn neutros, sin tokens marca  | 0.3.1   | Sí          |
| D-bvcpas-023 | Estilos: sólo Tailwind defaults + shadcn primitives sin modificar; cero CSS custom, gradientes, animaciones  | 0.3.2   | Sí          |
| D-bvcpas-024 | SDK HTTP tipado generado desde OpenAPI (`openapi-typescript` + `openapi-fetch`); schema commiteado al repo | 0.3.2   | Sí          |
| D-bvcpas-025 | Migración de `http.ts` → SDK diferida a v0.4.1 (sólo `useSession` queda; `useClientsList` se borró en v0.4.0) | 0.3.2   | Sí          |
| D-bvcpas-026 | Heurística view-vs-CRUD: `/v1/<recurso>` plano para 1:1 con tabla; `/v1/views/<x>` sólo cuando hay orquestación | 0.4.0   | Sí          |
| D-bvcpas-027 | Sidebar consume `GET /v1/clients` directo (supera D-bvcpas-015 — `/v1/dashboards/customer-support` fue eliminado) | 0.4.0   | Sí          |
| D-bvcpas-028 | Primer consumidor del SDK tipado en producción: `clients.api.ts` del módulo 11-clients                    | 0.4.0   | No          |
| D-bvcpas-029 | Sidebar usa `pageSize=200` sin paginación real; agregar loop cuando algún tenant rebase 200 clientes      | 0.4.1   | No          |
| D-bvcpas-030 | Tab Customer Support consume view `/v1/clients/:id/uncats`; wrapper vive en `13-dashboards` (corolario 026) | 0.5.0   | No          |
| D-bvcpas-031 | "Mes actual del dashboard" = mes anterior real; helpers en `12-customer-support/lib/date-range.ts`        | 0.5.0   | No          |
| D-bvcpas-032 | División v0.5.0 / v0.5.1 para Customer Support: header+stats en 12-cs; tabla de transactions en 14-tx     | 0.5.0   | No          |

---

## Onboarding rápido para sesión nueva

```
Trabajo en d:/proyectos/bvcpas-project/apps/bvcpas/. Lee en orden:
  1. apps/bvcpas/roadmap/CONVENTIONS.md             — reglas del frontend
  2. apps/bvcpas/roadmap/README.md                  — proceso, índice, decisiones
  3. apps/bvcpas/roadmap/<NN-modulo>/README.md      — TDD del módulo activo
  4. apps/bvcpas/roadmap/<NN-modulo>/vX.Y.Z.md      — versión 🚧 (si hay)
  5. apps/bvcpas/roadmap/BACKLOG.md                 — items diferidos por trigger

Mi siguiente tarea es: [describe qué quieres hacer].
```
