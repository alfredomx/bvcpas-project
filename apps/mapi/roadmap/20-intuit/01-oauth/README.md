# 20-intuit/01-oauth — OAuth Intuit + tokens encriptados + migración 77 clientes

**App:** mapi
**Status:** 📅 Pendiente (P1)
**Versiones que lo construyen:** —
**Última revisión:** 2026-05-03

---

## Por qué existe este sub-bloque

El operador tiene 77 clientes activos en mapi v0.x con OAuth Intuit ya autorizado y tokens vivos. `bvcpas-project` necesita el mismo flujo OAuth + el mismo modelo de tokens encriptados, más un script one-shot para migrar los 77 clientes desde mapi v0.x prod sin que ningún cliente tenga que re-autorizar.

Sin esto, ningún Mx puede leer datos de QBO. Es el primer pre-requisito post-foundation.

---

## Alcance (TBD — se diseña cuando arranque la versión)

### Sí entra (preliminar)

- Schema `intuit_tokens` con tokens encriptados AES-256-GCM (heredado mapi v0.x).
- Encryption service con crypto nativo Node (heredado D-046).
- OAuth callback `POST /v1/intuit/callback` (intuit-oauth SDK).
- Refresh transparente en `apiCall` (heredado D-118 mapi v0.x — fix shape completo del SDK).
- Endpoint admin `POST /v1/admin/intuit/migrate-from-legacy` (one-shot, lee de mapi v0.x prod, copia clientes + tokens encriptados, reencripta con nueva key).
- Errores de dominio: `IntuitRefreshTokenExpiredError` (HTTP 401), `IntuitTokenNotFoundError` (HTTP 404).
- Eventos event_log: `intuit.client.authorized`, `intuit.token.refreshed`, `intuit.token.refresh_failed`.

### NO entra (preliminar)

- Mappers de entidades QBO — cada uno entra con su Mx.
- Connectors automáticos (cron qbo-dev) — vive en `20-intuit/03-connectors/`.
- Bridge WebSocket — vive en `02-bridge/`.

---

## Migración de los 77 clientes

Script one-shot que:

1. Conecta a Postgres de mapi v0.x prod (read-only).
2. Para cada cliente con `intuit_tokens` vivos:
   - Decripta con key de mapi v0.x.
   - Inserta `clients` en bvcpas-project (o resuelve duplicado por `qbo_realm_id`).
   - Reencripta `intuit_tokens` con key de bvcpas-project.
3. Reporta: cuántos migrados, cuántos fallaron, motivos.
4. Deja a mapi v0.x sin tocar (read-only).

Tras correr y validar `GET /v1/healthz` + algún sync de prueba, los 77 clientes están operativos en bvcpas-project sin que ningún cliente tenga que re-autorizar.

---

## Notas

- Naming visible al operador (NAM-1) se aprueba cuando se abra la versión.
- El operador decide cuándo correr el script de migración (hay que coordinarlo con n8n actual).
- Mapi v0.x sigue corriendo en `mapi.alfredo.mx` durante la transición — apagado cuando los 77 clientes lleven ≥3 días estables en bvcpas-project.
