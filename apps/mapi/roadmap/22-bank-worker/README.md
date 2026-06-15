# 22-bank-worker — Worker de descarga bancaria (Chase, Wells Fargo, RBFCU, Broadway Bank, Frost)

**Estado del módulo**: ✅ Vault (v0.16.x) + adapter Chase Design B (v0.18.0) cerrados. 🚧 Step-flow de descarga (v0.21.0: login en vivo + cuentas + checks/deposits/statements/transactions + PDF storage) listo para revisión. 📅 Adapters delgados (v0.22.0) en discusión.
**Apertura**: 2026-06-12.

> **⚠️ PIVOTE Design B (2026-06-13) — lo de abajo sobre Playwright/CDP está OBSOLETO.**
> Las secciones "Norte", "adapters via Playwright", `connectOverCDP` y `apps/bank-worker/` aparte
> describen el plan VIEJO. El proyecto pivoteó a **Design B**: la lógica del banco vive en mapi y
> **kiro ejecuta los `fetch` en la sesión viva del banco** vía el bridge WS (`23-plugin-bridge`,
> construido en v0.17.0). NO se usa Playwright. El "worker" = módulo 22 (mapi) + plugin kiro, no un
> app separado. Ver [`v0.18.0.md`](v0.18.0.md) (ChaseAdapter portado a Design B) — D-mapi-BW-007.
> Las decisiones del VAULT (D-mapi-BW-001..006, las 3 tablas) **siguen vigentes**.

## Norte del módulo

Migrar el proyecto existente `D:\archived\sandbox\adapters` al monorepo bajo `apps/bank-worker/`, con los estándares actuales del proyecto (TypeScript estricto, ESLint/Prettier del repo, tests Jest, branch por módulo `mapi/22-bank-worker`, tags `mapi-vX.Y.Z`).

Los 5 adapters bancarios ya existen y funcionan en su proyecto original:

- **Chase** — usa API interna del banco, sesión vía Chrome (CDP), trust de dispositivo ~6+ meses.
- **Wells Fargo**.
- **RBFCU** (sin descarga de estados de cuenta — limitación conocida del adapter actual).
- **Broadway Bank**.
- **Frost**.

Operan a través de `IBankAdapter` (clase abstracta) con métodos: `getAllAccounts`, `searchTransactions`, `downloadChecks`, `downloadDeposits`, `downloadTransactions(CSV|QBO)`, `downloadStatements`. Reciben una `page` de Playwright conectada a una instancia de Chrome existente (`connectOverCDP`).

## Catálogo de cuentas bancarias

El catálogo hoy vive en un Excel del operador con 2 pestañas:

- **Pestaña Portales** (~275 portales): `vendor`, `url`.
- **Pestaña Clientes**: `Client`, `Account`, `Status`, `Portal`, `User`, `Password`, `Security Question / Code`, `Notes`.

Mezcla de relaciones:

- 1 portal puede tener cuentas de varios clientes.
- 1 portal-cliente puede tener varias cuentas reales dentro (Chase con N cuentas dentro de un mismo login).
- Algunas cuentas dentro de un portal están cerradas o no aplican para descarga.

Por eso el modelo se parte en **3 tablas**.

## Decisión D-mapi-BW-001 — separación catálogo de portales / credenciales del cliente / cuentas individuales

3 tablas:

1. **`bank_portals`** (catálogo abierto de portales bancarios)
   - `id` (uuid), `name` (text, único), `portal_url` (text), `created_at`, `updated_at`.
   - Empieza vacío. Se pobla por seed o por endpoint admin. Crece libre (275 portales hoy, más mañana).

2. **`client_bank_accounts`** (credenciales de un cliente para un portal)
   - `id` (uuid), `client_id` (uuid, FK clients), `bank_portal_id` (uuid, FK bank_portals).
   - `username_encrypted`, `password_encrypted`, `security_qa_encrypted` (nullable).
   - `status` (CHECK: `active|blocked|closed`), `notes` (text, nullable).
   - `created_at`, `updated_at`.
   - Único: `(client_id, bank_portal_id)`.

3. **`bank_accounts`** (cuentas individuales dentro del login del cliente)
   - `id` (uuid), `client_bank_account_id` (uuid, FK client_bank_accounts).
   - `account_mask` (varchar 4), `account_type` (CHECK: `checking|savings|credit_card|loan|other`).
   - `label` (text, nullable), `status` (CHECK: `active|closed|blocked`), `notes` (text, nullable).
   - `created_at`, `updated_at`.
   - Único: `(client_bank_account_id, account_mask)`.

**No incluye**: `gl_code` (descartado), `owner_user_id`, `label` en `client_bank_accounts`, `download_enabled`, `opened_at`, `closed_at`.

## Decisión D-mapi-BW-002 — encriptación de credenciales

Las credenciales se persisten encriptadas desde el día 1, reutilizando el helper de `EncryptionService` existente del repo (mismo patrón que `intuit_tokens`, conexiones Microsoft/Dropbox/Google/Square en `21-connections`).

## Decisión D-mapi-BW-003 — `bank_portals` es catálogo abierto, NO enum hardcoded

El operador tiene 275 portales hoy y crecerá. Hardcodear 5 valores en código (chase/wells_fargo/etc.) representaría solo qué adapters están programados, no qué portales existen en su Excel. Las tablas modelan la realidad de los datos del operador.

Consecuencia: `bank_portals` empieza vacío, el seed lo pobla, CRUD completo para gestionarlo. Los adapters (v0.16.0+) saben internamente a qué `bank_portals.id` corresponden (config interna del worker, no del schema).

## Decisión D-mapi-BW-004 — seed inicial desde 2 CSVs

El operador exporta su Excel como 2 CSVs (`bank-portals.csv` y `bank-credentials.csv`) en `apps/mapi/seeds/`. El script `pnpm seed:bank-accounts` los lee y popula `bank_portals` (paso 1) + `client_bank_accounts` (paso 2). Idempotente.

## Decisión D-mapi-BW-006 — la columna `Account` del CSV de credenciales se ignora

`Account` en el Excel es texto libre del operador describiendo qué tipos de cuentas existen dentro del login (ej. "Checking, Savings, CC"). Las cuentas reales viven en la tabla `bank_accounts` con `account_mask` + `account_type` específicos. El texto libre no se puede convertir directamente. Se ignora en el seed; las filas de `bank_accounts` se crean después manualmente por la web.

## Progresión real (Design B)

- **v0.16.x** — Vault: 3 tablas (`bank_portals`, `client_bank_accounts`, `bank_accounts`) + CRUD admin + seed CSV + multi-credencial + credenciales descifradas en lectura. (D-mapi-BW-001..006, vigentes.)
- **v0.17.0** — `23-plugin-bridge`: bridge WS mapi↔plugin (gateway + `BridgeCommandService`). Base de Design B.
- **v0.18.0** — **Adapter Chase** portado a Design B (los 6 métodos). El adapter (lógica del banco) vive en mapi; kiro ejecuta los `fetch` en la sesión viva. Validado en vivo contra Chase real. (D-mapi-BW-007..010, ver [`v0.18.0.md`](v0.18.0.md).)
- **v0.21.0** 🚧 — **Step-flow de descarga**: `list_credentials` (picker sin secretos) + `list_accounts` (auto-login en vivo + cuentas reales + ancla `today`) + `download_{checks,deposits,statements,transactions}` (preset de rango en inglés o `from`+`to` → MM-DD-YYYY en zona del cliente, array de masks) + **PDF storage** (formato del operador portado de `bankify`: checks `MM-DD-YYYY - <check>.pdf`, deposits `... (<amount>).pdf`, statements `YYYY-MM.pdf`, transactions `<mask> (<from> to <to>).csv|qbo`) + `client_aliases` (resolve_client persistente). Registry portal→adapter. Smoke en vivo parcial (Bilia/Chase). (D-mapi-BW-011..020, ver [`v0.21.0.md`](v0.21.0.md).)
- **v0.22.0** 📅 — **Adapters delgados**: partir los `downloadX` gordos en primitivas (1 op de banco c/u) y subir la política (rango/latest/nombrado) al `BankDownloadService`. Resuelve el modo "latest" de statements y cubre el smoke en vivo pendiente (transactions + depósitos-con-cheques). Ver BACKLOG. TDD primero.
- **Siguientes** — más adapters (Wells Fargo, RBFCU, Broadway, Frost), mismo patrón (port a Design B). Después: wrapper MCP de los step-tools, OTP inbound, destino Dropbox. Orden según necesidad real.

## Estructura física (Design B)

NO hay `apps/bank-worker/` aparte ni Playwright/CDP. El "worker" = módulo 22 en mapi + plugin kiro:

```
apps/mapi/src/modules/22-bank-worker/
├── (vault) bank-portals / client-bank-accounts / bank-accounts (controllers, services, repos)
├── adapters/
│   ├── bank-fetch.types.ts         ← BankFetchExecutor + FetchResult (transporte agnóstico)
│   ├── bridge-fetch-executor.ts    ← impl sobre BridgeCommandService (reemplaza page.request.fetch)
│   ├── bank-adapter.base.ts        ← contrato base (ex-IBankAdapter)
│   └── chase.adapter.ts            ← lógica de Chase (el moat) — v0.18.0
└── chase.controller.ts             ← /v1/clients/:id/banking/chase/*

apps/kiro/  ← plugin: ejecuta los fetch en la sesión viva del banco (21-fetch-executor + 10-bridge-client)
```

El moat (endpoints, CSRF, paginación) vive en mapi; el plugin nunca ve esa lógica.

## Fuera de alcance del módulo (BACKLOG)

- **Script de descubrimiento de carpeta Dropbox por regex + mask** — al llegar el primer adapter (v0.16.0+) hay que decidir dónde escribir los PDFs descargados. El operador propuso un script que busque la carpeta destino con regex sobre el nombre + mask de la cuenta. Se difiere hasta v0.16.0.
- Onboarding asistido de cuentas nuevas (login en vivo con captura SMS, flujo de "el operador inicia sesión la primera vez para registrar device trust"). Se difiere — caso de uso ~1-2 cuentas/mes, no bloquea.
- Endpoint HTTP del worker y wrapper MCP del tool `bank_download`. Se difiere hasta tener al menos 1 adapter funcionando en este monorepo (v0.16.0+).
- Generación de PDFs finales. Se difiere a la versión del primer adapter, donde se aterriza con un caso real.
- Carga masiva de `bank_accounts` (cuentas individuales) — se llenan después por la web fila por fila.

## Versiones

| Versión | Estado | Tema                                                                                                                                              | Archivo                  |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 0.15.0  | 📅     | Scaffold worker + tablas + CRUD admin + seed CSV (sin adapter)                                                                                    | [v0.15.0.md](v0.15.0.md) |
| 0.16.0  | ✅     | bank-worker módulo 22 (portales, credenciales, cuentas)                                                                                           | [v0.16.0.md](v0.16.0.md) |
| 0.16.2  | ✅     | Response DTOs tipados en OpenAPI (SDK frontend deja de ser `never`)                                                                               | [v0.16.2.md](v0.16.2.md) |
| 0.16.3  | ✅     | Credenciales descifradas en las respuestas de lectura (vault)                                                                                     | [v0.16.3.md](v0.16.3.md) |
| 0.16.4  | ✅     | Multi-credencial por (cliente, portal) + re-seed (+101 recuperadas)                                                                               | [v0.16.4.md](v0.16.4.md) |
| 0.18.0  | ✅     | Adapter Chase portado a Design B (6 métodos) + endpoints + validado en vivo                                                                       | [v0.18.0.md](v0.18.0.md) |
| 0.21.0  | ✅     | Step-flow descarga: login en vivo + cuentas + checks/deposits/statements/transactions + PDF storage + presets                                     | [v0.21.0.md](v0.21.0.md) |
| 0.22.0  | ✅     | Adapters delgados (primitivas) + política en mapi + modo "latest"                                                                                 | [v0.22.0.md](v0.22.0.md) |
| 0.23.0  | ✅     | Read verbs (checks/deposits/statements list) — preview sin descargar imágenes/PDF                                                                 | [v0.23.0.md](v0.23.0.md) |
| 0.25.0  | ✅     | Descargas por la cola (worker BullMQ concurrency 1) → visibles en bull-board                                                                      | [v0.25.0.md](v0.25.0.md) |
| 0.25.1  | ✅     | Progreso fino (objeto etapa+done/total) por-ítem en la pestaña Progress de bull-board                                                             | [v0.25.1.md](v0.25.1.md) |
| 0.26.0  | ✅     | Desloguear + cerrar pestaña tras cada extracción (`close_tab` + receta logout Chase) — 401 unit verdes                                            | [v0.26.0.md](v0.26.0.md) |
| 0.27.0  | ✅     | Verbo único `POST /v1/banking/download` (resuelve cliente+credencial+login+descarga+logout en 1 llamada) — 411 unit verdes                        | [v0.27.0.md](v0.27.0.md) |
| 0.28.0  | ✅     | Verbo batch: `client` acepta array → 1 job `client-download` por cliente (worker hace login→descarga→logout), async por la cola — 412 unit verdes | [v0.28.0.md](v0.28.0.md) |
| 0.28.1  | ✅     | Credenciales per-cliente con `portal` (join) + filtro `?portal=`; `save` por default en el verbo de descarga — 418 unit verdes                    | [v0.28.1.md](v0.28.1.md) |
