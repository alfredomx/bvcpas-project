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
- `12-customer-support` ✅ (v0.5.0–v0.5.9 + v0.6.0 + v0.7.0 — tab Uncat. Transactions completa: stats, timeline, modal de transacción, writeback QBO, follow-ups, public links y call log).
- `13-dashboards` ✅ (v0.5.0 — primera view real `uncats-detail`).
- `14-transactions` ✅ (v0.5.1 — `useTransactions` + `useSyncTransactions` consumiendo `/v1/clients/:id/transactions[/sync]`).
- `15-app-shell` ✅ (v0.3.0 + v0.3.1 + v0.4.0 + v0.5.1 + v0.9.0 — sidebar + tabs + icon rail rediseñado).
- `16-public-uncats` ✅ (v0.8.0 — pantalla pública `/p/uncats/[token]` sin login para el cliente final).
- `17-client-home` ✅ (v0.9.0 — Client Home; su roadmap vive en `15-app-shell/v0.9.0`).
- `18-integrations` ✅ (v0.10.0 — pantalla de integraciones del cliente conectada al backend real: pause/resume/check status).
- `19-bank-accounts` ✅ (v0.11.0 vista global + v0.12.0 vista por cliente con credenciales descifradas).

**Política de testing** (desde v0.3.0): TDD-first. Tests antes que
código. Ver [CONVENTIONS.md §12](CONVENTIONS.md#12-testing).

**Pendiente / próximas versiones** (derivado de las secciones "fuera
de scope" de las versiones cerradas — ver [`BACKLOG.md`](BACKLOG.md)):

- Tab "Banking" **por cliente** (la vista global ya está en v0.11.0;
  falta la per-cliente reusando los hooks de `19-bank-accounts`).
- Tabs del detalle aún en placeholder conforme mapi exponga datos
  reales (Reconciliations, W-9, 1099, Mgt Report, Tax Packet, QTR
  Payroll, Property Tax).
- Envío real del follow-up por correo (hoy v0.6.0 es PATCH simulado,
  sin Microsoft Graph / plantilla) — ver D-bvcpas-068.
- Migración de `useSession` al SDK tipado + borrado de `@/lib/http.ts`
  (cierra D-bvcpas-025).
- Tab Settings global cross-cutting (legal_name, tier, industry,
  conexiones) — segunda parte D-bvcpas-033.

> **Deuda de proceso (actualizado 2026-06-13):** ~~las releases v0.7.0–
> v0.11.0 no tienen tag git~~ — RESUELTO: taggeadas retroactivamente
> (`bvcpas-v0.7.0`…`v0.11.0`) junto con `bvcpas-v0.12.0`; ya no hay
> huecos de tag. Pendiente aún: `17-client-home` no tiene carpeta propia
> en `roadmap/` (su roadmap está embebido en `15-app-shell/v0.9.0.md`).

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

| Carpeta             | Status | TDD                                        | Versiones                                                                                                                          |
| ------------------- | ------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 00-foundation       | ✅     | [README.md](00-foundation/README.md)       | [v0.1.0](00-foundation/v0.1.0.md) + [v0.3.2](00-foundation/v0.3.2.md)                                                              |
| 10-core-auth        | ✅     | [README.md](10-core-auth/README.md)        | [v0.2.0](10-core-auth/v0.2.0.md) + [v0.2.1](10-core-auth/v0.2.1.md)                                                                |
| 11-clients          | ✅     | [README.md](11-clients/README.md)          | [v0.4.0](11-clients/v0.4.0.md) + [v0.4.1](11-clients/v0.4.1.md) + v0.5.2                                                           |
| 12-customer-support | ✅     | [README.md](12-customer-support/README.md) | v0.5.0–[v0.5.9](12-customer-support/v0.5.9.md) + [v0.6.0](12-customer-support/v0.6.0.md) + [v0.7.0](12-customer-support/v0.7.0.md) |
| 13-dashboards       | ✅     | [README.md](13-dashboards/README.md)       | (primera view real en v0.5.0; TDD vive en 12-customer-support)                                                                     |
| 14-transactions     | ✅     | [README.md](14-transactions/README.md)     | [v0.5.1](14-transactions/v0.5.1.md)                                                                                                |
| 15-app-shell        | ✅     | [README.md](15-app-shell/README.md)        | [v0.3.0](15-app-shell/v0.3.0.md) + [v0.3.1](15-app-shell/v0.3.1.md) + [v0.9.0](15-app-shell/v0.9.0.md)                             |
| 16-public-uncats    | ✅     | (sin README; TDD en v0.8.0)                | [v0.8.0](16-public-uncats/v0.8.0.md) → app v0.8.0                                                                                  |
| 17-client-home      | ✅     | (sin carpeta; TDD en 15-app-shell/v0.9.0)  | (entregado en app v0.9.0)                                                                                                          |
| 18-integrations     | ✅     | (sin README; TDD en v0.1.0)                | [v0.1.0](18-integrations/v0.1.0.md) → app v0.10.0                                                                                  |
| 19-bank-accounts    | ✅     | (sin README; TDD en v0.1.0/v0.12.0)        | [v0.1.0](19-bank-accounts/v0.1.0.md) (app v0.11.0) + [v0.12.0](19-bank-accounts/v0.12.0.md) (app v0.12.0)                          |

---

## Versiones (orden cronológico)

| Versión | Módulo              | Estado | Tema                                                                                                               | Tag            | Archivo                                                        |
| ------- | ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ | -------------- | -------------------------------------------------------------- |
| 0.1.0   | 00-foundation       | ✅     | Scaffold base (Tailwind v4, shadcn, alias `@/*`)                                                                   | bvcpas-v0.1.0  | [00-foundation/v0.1.0.md](00-foundation/v0.1.0.md)             |
| 0.2.0   | 10-core-auth        | ✅     | Login real contra mapi + sesión + guard                                                                            | bvcpas-v0.2.0  | [10-core-auth/v0.2.0.md](10-core-auth/v0.2.0.md)               |
| 0.2.1   | 10-core-auth        | ✅     | Tests retroactivos (Vitest + Testing Library)                                                                      | bvcpas-v0.2.1  | [10-core-auth/v0.2.1.md](10-core-auth/v0.2.1.md)               |
| 0.3.0   | 15-app-shell        | ✅     | AppShell visual + sidebar + tabs + 8 placeholders + diseño 1:1 con prototipo                                       | bvcpas-v0.3.0  | [15-app-shell/v0.3.0.md](15-app-shell/v0.3.0.md)               |
| 0.3.1   | 15-app-shell        | ✅     | Strip de diseño cosmético (D-bvcpas-022)                                                                           | bvcpas-v0.3.1  | [15-app-shell/v0.3.1.md](15-app-shell/v0.3.1.md)               |
| 0.3.2   | 00-foundation       | ✅     | SDK tipado desde OpenAPI (`openapi-typescript` + `openapi-fetch`)                                                  | bvcpas-v0.3.2  | [00-foundation/v0.3.2.md](00-foundation/v0.3.2.md)             |
| 0.4.0   | 11-clients          | ✅     | Sidebar consume `/v1/clients` directo + módulo 11-clients real (D-026/027/028)                                     | bvcpas-v0.4.0  | [11-clients/v0.4.0.md](11-clients/v0.4.0.md)                   |
| 0.4.1   | 11-clients          | ✅     | Fix sidebar paginación: `pageSize=200` (D-bvcpas-029)                                                              | bvcpas-v0.4.1  | [11-clients/v0.4.1.md](11-clients/v0.4.1.md)                   |
| 0.5.0   | 12-customer-support | ✅     | Tab Customer Support (parte 1: header + stats + timeline) — D-030/031/032                                          | bvcpas-v0.5.0  | [12-customer-support/v0.5.0.md](12-customer-support/v0.5.0.md) |
| 0.5.1   | 14-transactions     | ✅     | Tabla Uncategorized/AMA's + Sync + rename "Customer Support" → "Uncat. Transactions" — D-033/034/035               | bvcpas-v0.5.1  | [14-transactions/v0.5.1.md](14-transactions/v0.5.1.md)         |
| 0.5.2   | 12-customer-support | ✅     | `<CsConfigSheet>` (botón Configure → Sheet con 5 settings de envío) — D-036/037/038                                | bvcpas-v0.5.2  | [12-customer-support/v0.5.2.md](12-customer-support/v0.5.2.md) |
| 0.5.3   | 12-customer-support | ✅     | CSV emails (D-039/040) + fix toast transparente + activity timeline reactivo (D-041)                               | bvcpas-v0.5.3  | [12-customer-support/v0.5.3.md](12-customer-support/v0.5.3.md) |
| 0.5.4   | 12-customer-support | ✅     | Reorden de layout: tabs + Sync alineados; timeline 2/3 + suggested action 1/3                                      | bvcpas-v0.5.4  | [12-customer-support/v0.5.4.md](12-customer-support/v0.5.4.md) |
| 0.5.5   | 12-customer-support | ✅     | Modal de detalle de transacción + QBO accounts dropdown + nota con sufijo localStorage — D-042/043/044/045         | bvcpas-v0.5.5  | [12-customer-support/v0.5.5.md](12-customer-support/v0.5.5.md) |
| 0.5.6   | 12-customer-support | ✅     | Modal funcional (PATCH responses), combobox search, completed en frontend, layout ajustado — D-046/047/048/049/050 | bvcpas-v0.5.6  | [12-customer-support/v0.5.6.md](12-customer-support/v0.5.6.md) |
| 0.5.7   | 12-customer-support | ✅     | Writeback a QBO (?qbo_sync=true) + appended_text + mapeo de errores específicos — D-051/052/053/054                | bvcpas-v0.5.7  | [12-customer-support/v0.5.7.md](12-customer-support/v0.5.7.md) |
| 0.5.8   | 12-customer-support | ✅     | Delete response (soft-delete) + AlertDialog + formatAmount preciso — D-055/056/057/058                             | bvcpas-v0.5.8  | [12-customer-support/v0.5.8.md](12-customer-support/v0.5.8.md) |
| 0.5.9   | 12-customer-support | ✅     | Public link management en `<CsConfigSheet>` (enable/disable/regenerate) — D-059…067                                | bvcpas-v0.5.9  | [12-customer-support/v0.5.9.md](12-customer-support/v0.5.9.md) |
| 0.6.0   | 12-customer-support | ✅     | Suggested Next Action funcional + `<DraftFollowupDialog>` (+ fixes status D-074…078) — D-068…073                   | bvcpas-v0.6.0  | [12-customer-support/v0.6.0.md](12-customer-support/v0.6.0.md) |
| 0.7.0   | 12-customer-support | ✅     | Call log — `<CallLogDialog>` (registrar/listar/editar llamadas)                                                    | bvcpas-v0.7.0  | [12-customer-support/v0.7.0.md](12-customer-support/v0.7.0.md) |
| 0.8.0   | 16-public-uncats    | ✅     | Pantalla pública de uncats (`/p/uncats/[token]`) sin login                                                         | bvcpas-v0.8.0  | [16-public-uncats/v0.8.0.md](16-public-uncats/v0.8.0.md)       |
| 0.9.0   | 15-app-shell        | ✅     | Shell rediseñado: icon rail + Client Home + Integrations (mock)                                                    | bvcpas-v0.9.0  | [15-app-shell/v0.9.0.md](15-app-shell/v0.9.0.md)               |
| 0.10.0  | 18-integrations     | ✅     | Integrations conectado al backend real (pause/resume/check status)                                                 | bvcpas-v0.10.0 | [18-integrations/v0.1.0.md](18-integrations/v0.1.0.md)         |
| 0.11.0  | 19-bank-accounts    | ✅     | Bank Accounts — vista global cross-cliente de credenciales bancarias                                               | bvcpas-v0.11.0 | [19-bank-accounts/v0.1.0.md](19-bank-accounts/v0.1.0.md)       |
| 0.12.0  | 19-bank-accounts    | ✅     | Bank Accounts — vista por cliente + credenciales descifradas (bank-worker v0.16.3)                                 | bvcpas-v0.12.0 | [19-bank-accounts/v0.12.0.md](19-bank-accounts/v0.12.0.md)     |

---

## Decisiones acumuladas (`D-bvcpas-NNN`)

| ID           | Decisión                                                                                                                                                          | Versión     | Diverge TDD |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------- |
| D-bvcpas-001 | Cliente HTTP propio (~50 líneas sobre `fetch`), sin `ofetch`/`ky`/`axios`                                                                                         | 0.2.0       | No          |
| D-bvcpas-002 | `sessionStorage` (no `localStorage` ni cookie); checkbox "Keep me signed in" eliminado                                                                            | 0.2.0       | No          |
| D-bvcpas-003 | Validar sesión con `GET /v1/auth/me` al montar `(authenticated)/`                                                                                                 | 0.2.0       | No          |
| D-bvcpas-004 | `ApiError` como clase JS, no objetos planos ni Result types                                                                                                       | 0.2.0       | No          |
| D-bvcpas-005 | Form con `react-hook-form` + `zod` + shadcn `<Form>`                                                                                                              | 0.2.0       | No          |
| D-bvcpas-006 | Evento DOM `auth:unauthorized` para cerrar sesión global ante 401                                                                                                 | 0.2.0       | No          |
| D-bvcpas-007 | ~~Sin tests automatizados~~ — REVERTIDA por D-bvcpas-011                                                                                                          | 0.2.0       | No          |
| D-bvcpas-008 | Login vive en `/` (`src/app/page.tsx`), no en `/login`. La ruta `/login` no existe                                                                                | 0.2.0       | Sí          |
| D-bvcpas-009 | Sistema de tokens semánticos centralizado en `globals.css`; prohibido usar colores literales                                                                      | 0.2.0       | Sí          |
| D-bvcpas-010 | `useSession` como Context global (`<SessionProvider>`), no hook con estado local por instancia                                                                    | 0.2.0       | Sí          |
| D-bvcpas-011 | Adopción de testing (Vitest + Testing Library + JSDOM); TDD-first desde v0.3.0. Revierte D-bvcpas-007                                                             | 0.2.1       | Sí          |
| D-bvcpas-012 | Extracción de `mapErrorMessage` a `lib/map-error-message.ts` para testabilidad                                                                                    | 0.2.1       | Sí          |
| D-bvcpas-013 | `vitest.config.mts` (no `.ts`) por compat ESM con `vite-tsconfig-paths`; `esbuild.jsx='automatic'`                                                                | 0.2.1       | No          |
| D-bvcpas-014 | Adopción de React Query (`@tanstack/react-query`); `<QueryProvider>` en root layout                                                                               | 0.3.0       | Sí          |
| D-bvcpas-015 | Sidebar consume `GET /v1/dashboards/customer-support` (no `GET /v1/clients`) por tener stats                                                                      | 0.3.0       | Sí          |
| D-bvcpas-016 | Virtualización con `@tanstack/react-virtual` desde día 1, aunque sean <100 clientes                                                                               | 0.3.0       | No          |
| D-bvcpas-017 | `/dashboard` muestra empty state, NO auto-select del primer cliente                                                                                               | 0.3.0       | No          |
| D-bvcpas-018 | Customer Support tab también es placeholder en v0.3.0; pantalla real entra en v0.4.0                                                                              | 0.3.0       | Sí          |
| D-bvcpas-019 | Política de branches: `<app>/<NN-modulo>` sin versión; tag `<app>-vX.Y.Z`. Convención unificada con mapi                                                          | 0.3.0       | Sí          |
| D-bvcpas-020 | Naming campos: snake_case 1:1 con backend; sin adapters camelCase                                                                                                 | 0.3.0       | Sí          |
| D-bvcpas-021 | Aliases shadcn dentro de `@theme` con prefijo `--color-*` (no en `:root` plano) — Tailwind v4                                                                     | 0.3.0       | Sí          |
| D-bvcpas-022 | Strip de diseño cosmético antes de rediseñar desde cero — sólo aliases shadcn neutros, sin tokens marca                                                           | 0.3.1       | Sí          |
| D-bvcpas-023 | Estilos: sólo Tailwind defaults + shadcn primitives sin modificar; cero CSS custom, gradientes, animaciones                                                       | 0.3.2       | Sí          |
| D-bvcpas-024 | SDK HTTP tipado generado desde OpenAPI (`openapi-typescript` + `openapi-fetch`); schema commiteado al repo                                                        | 0.3.2       | Sí          |
| D-bvcpas-025 | Migración de `http.ts` → SDK diferida a v0.4.1 (sólo `useSession` queda; `useClientsList` se borró en v0.4.0)                                                     | 0.3.2       | Sí          |
| D-bvcpas-026 | Heurística view-vs-CRUD: `/v1/<recurso>` plano para 1:1 con tabla; `/v1/views/<x>` sólo cuando hay orquestación                                                   | 0.4.0       | Sí          |
| D-bvcpas-027 | Sidebar consume `GET /v1/clients` directo (supera D-bvcpas-015 — `/v1/dashboards/customer-support` fue eliminado)                                                 | 0.4.0       | Sí          |
| D-bvcpas-028 | Primer consumidor del SDK tipado en producción: `clients.api.ts` del módulo 11-clients                                                                            | 0.4.0       | No          |
| D-bvcpas-029 | Sidebar usa `pageSize=200` sin paginación real; agregar loop cuando algún tenant rebase 200 clientes                                                              | 0.4.1       | No          |
| D-bvcpas-030 | Tab Customer Support consume view `/v1/clients/:id/uncats`; wrapper vive en `13-dashboards` (corolario 026)                                                       | 0.5.0       | No          |
| D-bvcpas-031 | "Mes actual del dashboard" = mes anterior real; helpers en `12-customer-support/lib/date-range.ts`                                                                | 0.5.0       | No          |
| D-bvcpas-032 | División v0.5.0 / v0.5.1 para Customer Support: header+stats en 12-cs; tabla de transactions en 14-tx                                                             | 0.5.0       | No          |
| D-bvcpas-033 | Settings por pestaña con `<Sheet>` + tab "Settings" global cross-cutting (convención; primera impl en v0.5.2)                                                     | 0.5.1       | Sí          |
| D-bvcpas-034 | Renombramientos: cambio quirúrgico + nota `fix-*.md`. No se reescribe historia ni nombres internos                                                                | 0.5.1       | Sí          |
| D-bvcpas-035 | Tab "Customer Support" → "Uncat. Transactions" (label/slug); módulo `12-customer-support` queda como huella                                                       | 0.5.1       | No          |
| D-bvcpas-036 | Primera implementación de D-033: botón ⚙ Configure en `<CsHeader>` abre `<CsConfigSheet>` lateral derecho                                                         | 0.5.2       | No          |
| D-bvcpas-037 | Settings de envío de follow-up viven en el Sheet de la tab; tab Settings global aloja sólo lo estructural                                                         | 0.5.2       | No          |
| D-bvcpas-038 | Sin defaults hardcoded en frontend (ej. `cc_email = lorena@...`); el default vive en mapi al crear cliente                                                        | 0.5.2       | No          |
| D-bvcpas-039 | `csvEmailString` schema con `.transform()` interno que convierte vacío → `null` antes del refine                                                                  | 0.5.3       | No          |
| D-bvcpas-040 | Frontend valida emails con regex `^[^\s@,]+@[^\s@,]+\.[^\s@,]+$` por cada parte del CSV; mapi sólo `string\|null`                                                 | 0.5.3       | No          |
| D-bvcpas-041 | `<CsActivityTimeline>` recibe `mode` por props; state `tab` levantado al orquestador para sincronizar con `<CsTransactions>`                                      | 0.5.3       | No          |
| D-bvcpas-042 | Modal de transacción usa `<Dialog>` shadcn (no Sheet — es acción puntual, no panel de configuración)                                                              | 0.5.5       | No          |
| D-bvcpas-043 | Sufijo de nota guardado en localStorage por usuario (`bvcpas.noteSuffix`); la fecha se agrega al construir el preview                                             | 0.5.5       | No          |
| D-bvcpas-044 | Cuentas QBO vía proxy `POST /v1/intuit/realms/{realmId}/call`; tipos locales `QboAccount` (proxy devuelve `unknown`)                                              | 0.5.5       | No          |
| D-bvcpas-045 | Botón "Save" del modal es placeholder hasta v0.5.6 cuando mapi exponga endpoint autenticado de guardado de notas                                                  | 0.5.5       | Sí          |
| D-bvcpas-046 | `completed` lo calcula el frontend al hacer Save (note + qbo_account_id distinto al original); evita que mapi cargue catálogo QBO                                 | 0.5.6       | No          |
| D-bvcpas-047 | Cuentas QBO se cargan UNA vez en `<CustomerSupportScreen>` y se comparten por props a tabla y modal                                                               | 0.5.6       | No          |
| D-bvcpas-048 | Al guardar el modal se invalidan dos query keys: `transactions` (tabla) y `uncats-detail` (stats grid)                                                            | 0.5.6       | No          |
| D-bvcpas-049 | Editar shadcn Dialog para quitar `sm:max-w-lg` hardcodeado que impedía override del ancho desde className                                                         | 0.5.6       | No          |
| D-bvcpas-050 | Append text de nota no se manda al backend; concatenación al guardar va cuando se implemente writeback a QBO                                                      | 0.5.6       | No          |
| D-bvcpas-051 | Cierra D-050 parcial: checkbox "Update in QB's" dispara writeback real vía `?qbo_sync=true` en el PATCH                                                           | 0.5.7       | No          |
| D-bvcpas-052 | Mensajes de error específicos por `error.code` (QBO_ACCOUNT_ID_REQUIRED, TXN_TYPE_NOT_SUPPORTED, INTUIT_STALE_SYNC_TOKEN, INTUIT_API_ERROR)                       | 0.5.7       | No          |
| D-bvcpas-053 | `appended_text` siempre en body del PATCH; mapi lo ignora si `qbo_sync=false` y lo concatena a `client_note` si `true`. Input siempre se rellena con localStorage | 0.5.7       | No          |
| D-bvcpas-054 | `buildAppendedText(suffix, now)` devuelve "{sufijo} ({MM-DD-YYYY})"; el frontend calcula la fecha para evitar manejo de zona horaria en mapi                      | 0.5.7       | No          |
| D-bvcpas-055 | Botón Delete del modal solo visible si `transaction.response !== null` (ocultar evita confusión cuando no hay nota guardada)                                      | 0.5.8       | No          |
| D-bvcpas-056 | Confirmación previa con `<AlertDialog>` shadcn (no `confirm()` nativo); destructivo aunque reversible                                                             | 0.5.8       | No          |
| D-bvcpas-057 | Layout del footer del modal: `[Delete]  [☐ Update in QB's]              [Cancel] [Save]`                                                                          | 0.5.8       | No          |
| D-bvcpas-058 | `formatAmount` con 2 decimales y separador de miles (`$X,XXX.XX`) en todos los lugares; reemplaza el formato compacto v0.5.0                                      | 0.5.8       | Sí          |
| D-bvcpas-059 | Public link sin caducidad ni `maxUses` (siempre body `{purpose:'uncats'}`)                                                                                        | 0.5.9       | No          |
| D-bvcpas-060 | La URL pública viene del detail (`uncats-detail`), no se arma en el cliente                                                                                       | 0.5.9       | No          |
| D-bvcpas-061 | Sección Public link en el sheet: switch "Enabled" + botón "Regenerate"                                                                                            | 0.5.9       | No          |
| D-bvcpas-062 | Toggle ON→OFF (revoke) dispara `<AlertDialog>` confirm antes de revocar                                                                                           | 0.5.9       | No          |
| D-bvcpas-063 | Switch dedicado a revoke/unrevoke; "Generate" pasa a botón aparte                                                                                                 | 0.5.9       | No          |
| D-bvcpas-064 | `:linkId` de public-links requiere UUID (`publicLink.id`), no el token                                                                                            | 0.5.9       | No          |
| D-bvcpas-065 | El detail devuelve el último link aunque esté revocado (`revoked_at` indica estado)                                                                               | 0.5.9       | No          |
| D-bvcpas-066 | Invalidación de cache por prefijo `['uncats-detail']` (sin clientId, evita mismatch de key)                                                                       | 0.5.9       | No          |
| D-bvcpas-067 | Badges del header en minúsculas + badge condicional de public link (🔓/🔒)                                                                                        | 0.5.9       | No          |
| D-bvcpas-068 | Send de follow-up simulado pero realista: PATCH real mueve status/`sent_at`, sin enviar correo                                                                    | 0.6.0       | No          |
| D-bvcpas-069 | `period` (YYYY-MM) se calcula en el frontend con `currentPeriod()`, no lo devuelve el detail                                                                      | 0.6.0       | No          |
| D-bvcpas-070 | Visibilidad del Suggested: `uncats>0` y `sent_at` de mes/año estrictamente anterior                                                                               | 0.6.0       | No          |
| D-bvcpas-071 | `<DraftFollowupDialog>` reusable, montado desde Suggested y Quick Links                                                                                           | 0.6.0       | No          |
| D-bvcpas-072 | Quick Links: 6 botones, "Follow-up email" es el único funcional; resto placeholder                                                                                | 0.6.0       | No          |
| D-bvcpas-073 | Invalidación por prefijo `['uncats-detail']` tras el Send (corolario de D-066)                                                                                    | 0.6.0       | No          |
| D-bvcpas-074 | Sync bumpea `followup.status` a `ready_to_send` solo si `progress_pct === 0`                                                                                      | 0.6.0 (fix) | No          |
| D-bvcpas-075 | Transiciones automáticas de `followup.status` por progreso del período (sent/partial_reply/complete)                                                              | 0.6.0 (fix) | No          |
| D-bvcpas-076 | `computeNextFollowupStatus()` como única fuente de la regla de status (consumida por modal y tabla)                                                               | 0.6.0 (fix) | No          |
| D-bvcpas-077 | `progress_pct` calculado localmente en `<TxDetailModal>` (misma fórmula que mapi, sin esperar refetch)                                                            | 0.6.0 (fix) | No          |
| D-bvcpas-078 | Delete del modal borra el response (soft-delete), no la transacción QBO                                                                                           | 0.6.0 (fix) | No          |

> **Nota:** las versiones v0.7.0–v0.11.0 no registraron decisiones
> `D-bvcpas-NNN` numeradas (usaron `Dn` locales en su propio archivo).

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
