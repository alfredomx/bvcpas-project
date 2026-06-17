# intuit

## Qué hace

Conecta la cuenta de QuickBooks Online de un cliente (OAuth) y deja que mapi_v2 llame la API de Intuit a su nombre, con refresh de tokens transparente. Es la base de los connectors/CDC que vienen después.

## Estado

`✅ v0.1.0` — OAuth + tokens + proxy V3. (Connectors/CDC en versiones futuras.)

## Entradas / Salidas

**Parametrizado por:** `clientId` (el client ya existe en el core; intuit le adjunta la conexión QBO).

### Endpoints

| Método   | Ruta                                        | Qué hace                                          | Auth        |
| -------- | ------------------------------------------- | ------------------------------------------------- | ----------- |
| `POST`   | `/v1/intuit/oauth/connect`                  | `{ clientId }` → `{ authorizeUrl }`               | token admin |
| `GET`    | `/v1/intuit/oauth/callback`                 | callback de Intuit; guarda los tokens             | —           |
| `POST`   | `/v1/intuit/realms/:realmId/call`           | proxy genérico a la API V3 (refresh transparente) | token admin |
| `GET`    | `/v1/intuit/clients/:clientId/company-info` | `CompanyInfo` de QBO mapeada (para overwrite)     | token admin |
| `GET`    | `/v1/intuit/tokens`                         | estado de conexión por cliente                    | token admin |
| `DELETE` | `/v1/intuit/tokens/:clientId`               | revoca/borra la conexión de un cliente            | token admin |

## Config (env vars)

`INTUIT_CLIENT_ID`, `INTUIT_CLIENT_SECRET`, `INTUIT_REDIRECT_URI`, `INTUIT_ENVIRONMENT` (`sandbox`/`production`), `INTUIT_MINOR_VERSION` (default 75).

## Errores

`INTUIT_TOKENS_NOT_FOUND` (404) · `INTUIT_REFRESH_EXPIRED` (401) · `INTUIT_STATE_INVALID` (400) · `INTUIT_REALM_CONFLICT` (409) · `INTUIT_AUTH_ERROR` (502) · `INTUIT_BAD_REQUEST` (400).

## Usa del core (coarse)

`ClientsService` (leer el client), `EncryptionService` (cifrar tokens), `REDIS_CLIENT` (state OAuth), config, `AdminGuard`.

## NO hace (límites)

No define la entidad `clients` (es del core; intuit solo la consume). No guarda multi-realm por cliente. No hace connectors/CDC (versión futura). No sobreescribe el client solo (ofrece la info de QBO; tú decides).
