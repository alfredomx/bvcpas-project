# 27-client-reconnect — reconnect/disconnect por cliente (anti-mixup)

Gestión de la conexión QBO de un cliente concreto: re-autorizar (reconnect) y desconectar (disconnect), con **validación de que la compañía coincida** en el reconnect (no cambiar de realm en silencio).

> **Cara pública:** [`../../README.md`](../../README.md). · **Decisiones:** [`../README.md`](../README.md) (`D-intuit-NNN`).

## Por qué

Una conexión QBO puede romperse (refresh vencido, cliente revocó). Re-autorizar es volver a hacer OAuth para ese cliente. El riesgo (que el mapi viejo ya cuidaba): al re-autorizar, el operador podría elegir por error **otra compañía** en QBO → se cambiaría el realm del cliente en silencio (mixup grave en contabilidad). Hay que **exigir la misma compañía**.

## Diseño

- **Endpoints client-scoped** (`IntuitClientController`, bajo `AdminGuard`):
  - `POST /v1/intuit/clients/:clientId/reconnect` → `{ authorizeUrl }`. Reutiliza el `connect` client-first.
  - `DELETE /v1/intuit/clients/:clientId/connection` → `{ deleted }` (borra los tokens; 404 si no había conexión).
- **Anti-mixup en el state**: `connect` ahora guarda en Redis un state JSON `{ clientId, expectedRealm? }`. Si el cliente ya estaba conectado, `expectedRealm` = su realm actual.
- **Validación en el callback**: si `expectedRealm` está y la compañía autorizada (`realmId`) no coincide → `INTUIT_REALM_MISMATCH` (409), **no se cambia el realm**. (Se suma a la validación ya existente: realm ligado a OTRO cliente → `INTUIT_REALM_CONFLICT`.)
- **Para mover un cliente a otra compañía**: desconectar primero (DELETE connection) y reconectar — sin `expectedRealm`, ya se permite.

Aplica a TODO connect (no solo al endpoint reconnect): el shortcut dev y el `POST /oauth/connect` también quedan protegidos. GET/OAuth + borrado de fila propia — no escribe datos en QBO (sigue GET-only contra QBO).

## Endpoints

| Método   | Ruta                                      | Auth       |
| -------- | ----------------------------------------- | ---------- |
| `POST`   | `/v1/intuit/clients/:clientId/reconnect`  | AdminGuard |
| `DELETE` | `/v1/intuit/clients/:clientId/connection` | AdminGuard |

## Error nuevo

| Código                  | Status | Caso                                                       |
| ----------------------- | ------ | ---------------------------------------------------------- |
| `INTUIT_REALM_MISMATCH` | 409    | reconnect autorizó otra compañía ≠ la ya ligada al cliente |

## Alcance

### Sí entra

- `IntuitClientController` (reconnect POST + disconnect DELETE).
- `connect` guarda state JSON `{clientId, expectedRealm}`; `callback` valida mismatch.
- Error `IntuitRealmMismatchError` (409).
- Unit tests (connect captura realm; callback mismatch/match/conflict/invalid; controller).

### NO entra

- Reconnect de otros providers (otros plugins).
- Revocar el token también en QBO al desconectar (hoy solo borra local) — diferido.

## Versiones

| Versión | Estado | Tema                             | Tag           | Archivo             |
| ------- | ------ | -------------------------------- | ------------- | ------------------- |
| 0.8.0   | ✅     | reconnect/disconnect por cliente | intuit-v0.8.0 | [v0.8.0](v0.8.0.md) |
