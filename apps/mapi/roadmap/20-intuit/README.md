# 20-intuit — Integración con Intuit (OAuth + bridge + connectors)

**App:** mapi
**Status:** 📅 Pendiente
**Versiones que lo construyen:** —
**Última revisión:** 2026-05-03

---

## Por qué existe este bloque

Todo el valor del proyecto depende de poder leer y escribir en QuickBooks Online de los clientes del operador. Este bloque agrupa todo lo relacionado con Intuit:

1. **OAuth + tokens** (P1) — cómo el cliente autoriza, cómo guardamos tokens encriptados, cómo refrescamos.
2. **Bridge con plugin** (P2) — WebSocket gateway en mapi que el plugin `kiro` usa para comandos privilegiados (queries internas QBO que la API pública no expone).
3. **Connectors** — sync incremental qbo-dev (Developer API) y qbo-internal (vía plugin) para extraer datos QBO.

Es el equivalente al módulo `20-intuit-oauth` + `21-intuit-bridge` + `22-connectors` de mapi v0.x, agrupados aquí en un solo bloque numérico para no saturar las decenas (regla heredada con sub-numeración).

---

## Sub-bloques (orden secuencial)

| #   | Sub-bloque                                                                                 | Status | TDD                           | Versiones |
| --- | ------------------------------------------------------------------------------------------ | ------ | ----------------------------- | --------- |
| 01  | [oauth](01-oauth/README.md) — OAuth + tokens encriptados + refresh + migración 77 clientes | 📅 P1  | [README](01-oauth/README.md)  | —         |
| 02  | [bridge](02-bridge/README.md) — WebSocket gateway con kiro                                 | 📅 P2  | [README](02-bridge/README.md) | —         |
| 03  | connectors — qbo-dev + qbo-internal (cuando entre primer Mx que los necesite)              | 📅     | —                             | —         |

**Numeración de sub-bloques:** secuencial (01, 02, 03) porque hay dependencia: oauth primero, bridge después, connectors al final. Heredado del patrón mapi v0.x (`22-connectors/01-common/`, `02-qbo-dev/`, etc.).

---

## Alcance del bloque entero

### Sí entra (cuando se complete)

- Schema `intuit_tokens` con tokens encriptados AES-256-GCM (heredado D-046 mapi v0.x).
- OAuth callback + refresh transparente.
- Migración script para los 77 clientes desde mapi v0.x prod.
- WebSocket gateway en `/v1/bridge` con BridgeSecretGuard (auth simple para plugin).
- Connectors qbo-dev y qbo-internal (cuando un Mx los pida).

### NO entra

- Schema staging — vive en `30-staging/` cuando se necesite.
- Mappers entidad por entidad — cada mapper entra cuando un Mx los necesita.
- Plugin Chrome — vive en `apps/kiro/roadmap/10-bridge-client/`.

---

## Notas

- Mapi v0.x tiene `intuit_tokens` con shape probado en producción. Lo reusamos con renames si la operación lo requiere.
- BridgeSecretGuard (heredado mapi v0.x) vs JWT: decisión diferida hasta que entre `02-bridge`. Memoria del operador tiene el trigger de migración a JWT.
- 77 clientes en mapi v0.x prod tienen tokens activos. La migración es one-shot al cerrar P1.
