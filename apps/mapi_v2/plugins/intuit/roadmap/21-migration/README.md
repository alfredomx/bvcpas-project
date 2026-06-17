# 21-migration — migración de datos del prod viejo (`mapi` → `mapi_v2`)

Módulo de **migración one-off** del plugin intuit: trae los `clients` reales y sus conexiones QBO (tokens) desde la base del `mapi` viejo a `mapi_v2`, re-cifrando los tokens con la `ENCRYPTION_KEY` nueva.

> No es un módulo "vivo" (no expone endpoints ni servicios). Es un script de carga ejecutado una vez por entorno, documentado aquí para que sea auditable y repetible.

## Origen → destino

| Origen (mapi viejo)                      | Destino (mapi_v2) | Notas                                                                   |
| ---------------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| `clients` (campos genéricos)             | core `clients`    | Preserva el UUID. Sin QBO ni flags de uncats (esos viven en plugins).   |
| `user_connections` (`provider='intuit'`) | `intuit_tokens`   | `external_account_id` → `realm_id`. Tokens **descifrados+re-cifrados**. |

## Re-cifrado de tokens

Las `ENCRYPTION_KEY` de `mapi` y `mapi_v2` son distintas. El script descifra con la llave vieja (`apps/mapi/.env`) y vuelve a cifrar con la nueva (`apps/mapi_v2/.env`), usando el mismo formato AES-256-GCM `iv:authTag:ciphertext` (base64) que usa el `EncryptionService` del core — por eso los tokens migrados los lee mapi_v2 sin tocar nada más.

## Script

`apps/mapi_v2/scripts/migrate-from-mapi.mjs` — **gitignored** (one-off local, no es destino final del repo; ver `.gitignore`). Idempotente (upsert por `id` / `client_id`). Lee `DATABASE_URL` + `ENCRYPTION_KEY` de los `.env` de cada app. Salta conexiones con tokens/expiraciones nulas.

Correr: `node scripts/migrate-from-mapi.mjs` desde `apps/mapi_v2/`. Verificación: contar `clients` / `intuit_tokens` en destino y descifrar un token con la llave nueva.

## Versiones

| Versión | Estado | Tema                                       | Tag           | Archivo             |
| ------- | ------ | ------------------------------------------ | ------------- | ------------------- |
| 0.2.0   | ✅     | migración clients + intuit_tokens del prod | intuit-v0.2.0 | [v0.2.0](v0.2.0.md) |
