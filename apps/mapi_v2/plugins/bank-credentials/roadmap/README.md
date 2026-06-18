# Roadmap — `plugins/bank-credentials`

Proceso, índice y decisiones del **plugin Bank Credentials** de `mapi_v2`. Integración de dominio: se monta por el registro del core, consume `clients` + `EncryptionService`, y es dueño de sus tablas, rutas y errores.

> **Arquitectura del sistema:** [`../../../README.md`](../../../README.md) · **Cara pública:** [`../README.md`](../README.md).

> **Decisiones del core** (D-core-NNN): [`../../../core/roadmap/README.md`](../../../core/roadmap/README.md). Aquí van las del plugin (**D-bank-NNN**).

---

## Estado actual

El plugin versiona con tags `bank-credentials-vX.Y.Z`, independiente del core y de otros plugins.

- `10-credentials` ✅ (bank-credentials v0.1.0 — port del modelo de credenciales del mapi viejo: 3 tablas + CRUD + cifrado + migración de datos reales). **Cerrado 2026-06-17**, tag `bank-credentials-v0.1.0` · migración 294 portals / 596 credentials / 6 accounts · CRUD smoke en vivo verde.
- `11-port` ✅ (bank-credentials v0.2.0 — `BankCredentialsPort` en el core: contrato plugin→plugin para que `bank-downloader` obtenga las credenciales descifradas + nombre del portal). **Cerrado 2026-06-17**, tag `bank-credentials-v0.2.0`.

**Diferidos:** ver [BACKLOG.md](BACKLOG.md) (eventos cuando el core tenga event_log, worker de descarga = qubot, no aquí).

## Versionado y estados

SemVer `bank-credentials-MAJOR.MINOR.PATCH`. Estados: ✅ Completado · 🚧 En progreso (una a la vez) · 🔬 En discusión · 📅 Planeado.

## Reglas de proceso (heredadas del core)

1. **TDD aprobado por el operador antes de codear.**
2. **No bumpear nada hasta cerrar**; al cerrar: merge `--no-ff` a main + tag `bank-credentials-vX.Y.Z`.
3. **Cero reach:** el plugin usa SOLO la API pública del core + sus propios archivos.
4. **Dueño de sus tablas** (llaveadas por `client_id`), errores (`DomainError` con `code` + `status`), rutas bajo `/v1`.
5. Tags git con prefijo `bank-credentials-`.

## Índice de módulos

| Carpeta        | Status | Versiones                          |
| -------------- | ------ | ---------------------------------- |
| 10-credentials | ✅     | [v0.1.0](10-credentials/v0.1.0.md) |
| 11-port        | ✅     | [v0.2.0](11-port/v0.2.0.md)        |

## Decisiones acumuladas (`D-bank-NNN`)

| ID         | Decisión                                                                                                                                                                                                                              | Versión | Diverge |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- |
| D-bank-001 | El plugin es dueño de 3 tablas: `bank_portals` (catálogo GLOBAL, sin cliente) → `bank_credentials` (el login, FK `client_id` → core) → `bank_accounts` (cuentas individuales, FK `bank_credential_id`)                                | 0.1.0   | —       |
| D-bank-002 | Secretos (`username`/`password`/`security_qa`) cifrados con el `EncryptionService` del core (AES-256-GCM, `iv:authTag:ciphertext`); los DTOs nunca exponen los campos `*_encrypted`                                                   | 0.1.0   | —       |
| D-bank-003 | Rutas **flat** `/v1/bank/*`; `clientId` NUNCA en el path → filtro `?clientId=` en listas, campo del body en alta. `bank_portals` y la vista global son recursos globales ([[feedback_api_route_convention]])                          | 0.1.0   | —       |
| D-bank-004 | **Sin eventos** en v0.1.0: mapi_v2 no tiene `event_log` en el core (ni intuit emite). El mapi viejo sí emitía → se difiere al BACKLOG hasta que el core monte un `event_log`                                                          | 0.1.0   | Sí      |
| D-bank-005 | Migración de datos reales = script one-off **gitignored** (`apps/mapi_v2/scripts/`); descifra con la llave vieja y re-cifra con la nueva (mismo patrón que intuit v0.2.0, D-intuit-009)                                               | 0.1.0   | —       |
| D-bank-006 | Renombre: el confuso `client_bank_accounts` (el login) → `bank_credentials`; `bank_portals` y `bank_accounts` conservan nombre; el FK del hijo pasa a `bank_credential_id`                                                            | 0.1.0   | Sí      |
| D-bank-007 | Los GET devuelven las credenciales **descifradas** (plaintext): el operador las necesita para entrar al banco. Es data nuestra, no API externa → CRUD completo (sin la restricción GET-only de QBO)                                   | 0.1.0   | —       |
| D-bank-008 | `BankCredentialsPort` publicado en el **core** (token + interfaz `getDecrypted`); `bank-credentials` lo liga `@Global` y exporta solo el token (D-core-027). Primer contrato plugin→plugin del proyecto; lo consume `bank-downloader` | 0.2.0   | —       |
