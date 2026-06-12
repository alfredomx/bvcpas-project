# 22-bank-worker — Worker de descarga bancaria (Chase, Wells Fargo, RBFCU, Broadway Bank, Frost)

**Estado del módulo**: 🔬 En discusión (TDD vivo).
**Apertura**: 2026-06-12.

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

## Sub-versiones planeadas

- **v0.15.0** — Scaffold del worker (`apps/bank-worker/`) + 3 tablas + CRUD admin completo + seed CSV. Sin adapters todavía.
- **v0.16.0** — Adapter Chase migrado (+ endpoint de descarga + integración Dropbox).
- **v0.17.0** — Adapter Wells Fargo.
- **v0.18.0** — Adapter RBFCU (sin estados de cuenta, documentado).
- **v0.19.0** — Adapter Broadway Bank.
- **v0.20.0** — Adapter Frost.
- **v0.2X.0** — MCP server con tool `bank_download` (orden depende de prioridad operativa).

El orden de v0.17.0 → v0.20.0 puede reordenarse según necesidad real (cliente con más urgencia, demo, etc.).

## Estructura física propuesta en el monorepo

```
apps/bank-worker/                          ← worker nuevo (proyecto B del operador)
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── jest.config.cjs
├── src/
│   ├── core/
│   │   └── IBankAdapter.ts                ← portado del proyecto original
│   ├── adapters/
│   │   ├── chase/                         ← se agrega en v0.16.0
│   │   ├── wells-fargo/                   ← v0.17.0
│   │   ├── rbfcu/                         ← v0.18.0
│   │   ├── broadway/                      ← v0.19.0
│   │   └── frost/                         ← v0.20.0
│   ├── chrome/
│   │   └── cdp.ts                         ← connectOverCDP helper
│   └── index.ts                           ← entrypoint (HTTP/CLI según se defina)
└── test/
```

En `apps/mapi/src/modules/22-bank-worker/` viven las tablas, repositorios, CRUD admin y el seed. El worker propiamente dicho vive en `apps/bank-worker/` y se comunica con `mapi` por HTTP cuando llegue v0.16.0+.

## Fuera de alcance del módulo (BACKLOG)

- **Script de descubrimiento de carpeta Dropbox por regex + mask** — al llegar el primer adapter (v0.16.0+) hay que decidir dónde escribir los PDFs descargados. El operador propuso un script que busque la carpeta destino con regex sobre el nombre + mask de la cuenta. Se difiere hasta v0.16.0.
- Onboarding asistido de cuentas nuevas (login en vivo con captura SMS, flujo de "el operador inicia sesión la primera vez para registrar device trust"). Se difiere — caso de uso ~1-2 cuentas/mes, no bloquea.
- Endpoint HTTP del worker y wrapper MCP del tool `bank_download`. Se difiere hasta tener al menos 1 adapter funcionando en este monorepo (v0.16.0+).
- Generación de PDFs finales. Se difiere a la versión del primer adapter, donde se aterriza con un caso real.
- Carga masiva de `bank_accounts` (cuentas individuales) — se llenan después por la web fila por fila.

## Versiones

| Versión | Estado | Tema                                                           | Archivo                  |
| ------- | ------ | -------------------------------------------------------------- | ------------------------ |
| 0.15.0  | 📅     | Scaffold worker + tablas + CRUD admin + seed CSV (sin adapter) | [v0.15.0.md](v0.15.0.md) |
