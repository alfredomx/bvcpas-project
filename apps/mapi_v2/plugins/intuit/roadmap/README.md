# Roadmap — `plugins/intuit`

Proceso, índice y decisiones del **plugin Intuit** (QuickBooks Online) de `mapi_v2`. Integración de dominio: se monta en el core por el registro, consume `clients` + `EncryptionService` del core, y es dueño de sus tablas, config y errores.

> **Arquitectura del sistema:** [`../../../README.md`](../../../README.md) — léela primero. · **Cara pública del plugin:** [`../README.md`](../README.md).

> **Decisiones del core** (D-core-NNN): [`../../../core/roadmap/README.md`](../../../core/roadmap/README.md). Aquí van las del plugin (**D-intuit-NNN**).

---

## Estado actual

**Versión `package.json` del host: compartida** (el plugin no tiene package.json propio; vive en el host). El plugin versiona con tags `intuit-vX.Y.Z`.

- `20-intuit-oauth` ✅ (intuit v0.1.0 — OAuth client-first + `intuit_tokens` + refresh + `IntuitApiService`). **Cerrado 2026-06-17**, tag `intuit-v0.1.0`.
- `21-migration` ✅ (intuit v0.2.0 — migración de clients + tokens reales del prod viejo, re-cifrados con la `ENCRYPTION_KEY` nueva). **Cerrado 2026-06-17**, tag `intuit-v0.2.0`.
- `22-typed-reads` ✅ (intuit v0.3.0 — endpoints GET tipados por type de QBO: 30 entidades list+by-id, exchange-rate, 20 reports. Read-through, GET-only, rutas `/v1/intuit/:clientId/...`). **Cerrado 2026-06-17**, tag `intuit-v0.3.0` · smoke en vivo 49/51.
- `23-uncat-amas` ✅ (intuit v0.4.0 — report derivado uncats + AMA sobre `TransactionList`, read-through GET-only). **Cerrado 2026-06-17**, tag `intuit-v0.4.0` · smoke en vivo 51 filas.
- `24-list-pagination` ✅ (intuit v0.5.0 — auto-paginado de los list + tope; arregla el truncado silencioso a 1000 de v0.3.0). **Cerrado 2026-06-17**, tag `intuit-v0.5.0` · smoke en vivo purchases 1000→12 847.

**Próximo (después de v0.5.0):** connectors / persistencia / backfill / CDC · snapshot de uncats para notas del cliente. Mutaciones (POST/PATCH/DELETE) a pedido, una por una.

## Versionado y estados

SemVer `intuit-MAJOR.MINOR.PATCH`, independiente del core y de otros plugins. Mismos estados que el core (✅ / 🚧 / 🔬 / 📅). Una versión `🚧` a la vez en el plugin.

## Reglas de proceso (heredadas del core)

1. **TDD aprobado por el operador antes de codear.**
2. **No bumpear nada hasta cerrar**; al cerrar: merge `--no-ff` a main + tag `intuit-vX.Y.Z`.
3. **Cero reach:** el plugin usa SOLO la API pública del core (servicios inyectados) + sus propios archivos. Nunca toca entrañas del core ni de otro plugin.
4. **El plugin es dueño de sus tablas** (llaveadas por `client_id`), su config (Zod propio), sus errores (`DomainError` con `code` + `status`), sus rutas bajo `/v1`.
5. Tags git con prefijo `intuit-`.

## Índice de módulos del plugin

| Carpeta            | Status | TDD                                       | Versiones                              |
| ------------------ | ------ | ----------------------------------------- | -------------------------------------- |
| 20-intuit-oauth    | ✅     | [README.md](20-intuit-oauth/README.md)    | [v0.1.0](20-intuit-oauth/v0.1.0.md)    |
| 21-migration       | ✅     | [README.md](21-migration/README.md)       | [v0.2.0](21-migration/v0.2.0.md)       |
| 22-typed-reads     | ✅     | [README.md](22-typed-reads/README.md)     | [v0.3.0](22-typed-reads/v0.3.0.md)     |
| 23-uncat-amas      | ✅     | [README.md](23-uncat-amas/README.md)      | [v0.4.0](23-uncat-amas/v0.4.0.md)      |
| 24-list-pagination | ✅     | [README.md](24-list-pagination/README.md) | [v0.5.0](24-list-pagination/v0.5.0.md) |

## Versiones (orden cronológico)

| Versión | Módulo             | Estado | Tema                                           | Tag           | Archivo                                |
| ------- | ------------------ | ------ | ---------------------------------------------- | ------------- | -------------------------------------- |
| 0.1.0   | 20-intuit-oauth    | ✅     | OAuth client-first + tokens + IntuitApiService | intuit-v0.1.0 | [v0.1.0](20-intuit-oauth/v0.1.0.md)    |
| 0.2.0   | 21-migration       | ✅     | migración clients + intuit_tokens del prod     | intuit-v0.2.0 | [v0.2.0](21-migration/v0.2.0.md)       |
| 0.3.0   | 22-typed-reads     | ✅     | endpoints GET tipados (entidades + reports)    | intuit-v0.3.0 | [v0.3.0](22-typed-reads/v0.3.0.md)     |
| 0.4.0   | 23-uncat-amas      | ✅     | report derivado uncats + AMA                   | intuit-v0.4.0 | [v0.4.0](23-uncat-amas/v0.4.0.md)      |
| 0.5.0   | 24-list-pagination | ✅     | auto-paginado de los list + tope               | intuit-v0.5.0 | [v0.5.0](24-list-pagination/v0.5.0.md) |

## Decisiones acumuladas (`D-intuit-NNN`)

| ID           | Decisión                                                                                                                                                                              | Versión | Diverge |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- |
| D-intuit-001 | OAuth **client-first**: el `client` se crea antes en el core (`POST /v1/clients`); `connect` recibe `clientId` y el callback solo adjunta los tokens                                  | 0.1.0   | Sí      |
| D-intuit-002 | El plugin es dueño de `intuit_tokens` (`client_id` FK → core clients, `realm_id` único, tokens encriptados con el `EncryptionService` del core)                                       | 0.1.0   | —       |
| D-intuit-003 | 1 client = 1 compañía QBO (`client_id` único). Varias compañías de una persona se agrupan por `owner` (tabla futura en core, aditiva, trigger W9/cruce), no se fusionan realms        | 0.1.0   | —       |
| D-intuit-004 | El callback no sobreescribe; `GET company-info` expone la info de QBO mapeada para que el frontend ofrezca overwrite → `PATCH /v1/clients/:id`. mapi nunca sobreescribe solo          | 0.1.0   | Sí      |
| D-intuit-005 | Convención de migraciones por plugin: una sola DB, un solo historial; el `drizzle.config` del host agrega los schemas de plugins por glob; cada plugin es dueño de su `*.schema.ts`   | 0.1.0   | —       |
| D-intuit-006 | Realm ya ligado a otro cliente en el callback → `409 INTUIT_REALM_CONFLICT` (no se sobreescribe en silencio)                                                                          | 0.1.0   | —       |
| D-intuit-007 | La migración de datos es un script one-off **gitignored** (`apps/mapi_v2/scripts/`), no código del repo; `.gitignore` anclado a esa ruta. Lógica documentada en el roadmap            | 0.2.0   | —       |
| D-intuit-008 | Solo se migran los campos **genéricos** de `clients` (los del core); los campos QBO/uncats viejos se traerán con el plugin que los posea (modelo WordPress)                           | 0.2.0   | —       |
| D-intuit-009 | Tokens **descifrados con la llave vieja + re-cifrados con la nueva** (las `ENCRYPTION_KEY` difieren); mismo formato `iv:authTag:ciphertext` base64 → mapi_v2 los lee sin cambios      | 0.2.0   | —       |
| D-intuit-010 | Reemplazar el `call` genérico por **una ruta literal dedicada y tipada por type** (no `:entity` paramétrico); plomería compartida (`IntuitReadService`) + catálogo único con test 1:1 | 0.3.0   | Sí      |
| D-intuit-011 | Las lecturas son **read-through** (en vivo de QBO, sin DB); persistencia/connectors/backfill/CDC en versiones futuras                                                                 | 0.3.0   | —       |
| D-intuit-012 | **GET-only** estricto; POST/PATCH/DELETE se agregan una por una a pedido del operador (datos contables reales — `feedback_solo_get_qbo`)                                              | 0.3.0   | —       |
| D-intuit-013 | Exclusiones: `CompanyInfo` (ya tiene endpoint mapeado), `TaxService` (create-only); `ExchangeRate` como GET dedicado (no queryable)                                                   | 0.3.0   | —       |
| D-intuit-014 | `by-id` uniforme por type aunque QBO rechace algunos (Preferences singleton, TaxCodes de sistema → 400 passthrough); se prefiere uniformidad sobre casos especiales                   | 0.3.0   | —       |
| D-intuit-015 | `src/types/*.ts` son tipos QBO **vendored** (doc de Intuit); `any` permitido ahí vía override de eslint scoped, sin reescribir las definiciones                                       | 0.3.0   | —       |
| D-intuit-016 | Rutas **sin segmento `clients`**: `/v1/intuit/:clientId/...` (el plugin ya cuelga de `/v1/intuit`); `company-info` de v0.1.0 conserva `clients` por ahora                             | 0.3.0   | —       |
| D-intuit-017 | Reports **derivados** (lógica propia sobre un report nativo) en service/controller separados de los passthrough; no tocan el catálogo `QBO_REPORTS` ni su test 1:1                    | 0.4.0   | —       |
| D-intuit-018 | Mapeo **posicional** del `TransactionList` portado del mapi viejo (probado); supuesto: orden de columnas estable, validado por smoke en vivo                                          | 0.4.0   | —       |
| D-intuit-019 | `uncat-amas`: salida **plana** con `category` (3 buckets) + filtro `?category`; conteos/resúmenes y snapshot para notas del cliente se difieren                                       | 0.4.0   | —       |
| D-intuit-020 | Aplanado defensivo de filas del report (`collectLeafRows`): recoge hojas con `ColData`, soporta report plano o agrupado por secciones                                                 | 0.4.0   | —       |
| D-intuit-021 | Los list **auto-paginan** (loop) y devuelven todo por default; arregla el truncado silencioso a 1000 de v0.3.0. `startPosition`/`maxResults` = override de una página (UI)            | 0.5.0   | Sí      |
| D-intuit-022 | **Tope** de 20 páginas (20 000) en el auto-paginado → `INTUIT_TOO_MANY_RECORDS` (400); nunca trunca callado. Bulk de entidades enormes = backfill/jobs futuro                         | 0.5.0   | —       |
