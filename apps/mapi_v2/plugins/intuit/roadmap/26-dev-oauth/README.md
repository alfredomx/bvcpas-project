# 26-dev-oauth — shortcut dev para autorizar QBO en 1 click

`GET /v1/_dev/oauth/intuit?clientId=<uuid>` → 302 a la URL de Intuit. Sin curl, sin token, sin copiar/pegar la authorize URL. **Solo se monta fuera de production.**

> **Cara pública:** [`../../README.md`](../../README.md). · **Decisiones:** [`../README.md`](../README.md) (`D-intuit-NNN`).

## Por qué

Autorizar un cliente hoy es: `POST /oauth/connect` con token admin → copiar `authorizeUrl` del JSON → pegar en el browser. Tedioso cuando das de alta varios. Este shortcut lo hace en 1 click: abres la URL en el navegador y caes directo en Intuit.

## Diseño

- `IntuitDevOauthController` con `GET /_dev/oauth/intuit?clientId=<uuid>` → 302 redirect.
- `@Public()` (sin token — es para el browser).
- **Reutiliza el flujo real** (`IntuitOauthService.connect`): valida el client (404 si no existe), guarda el state en Redis (TTL 600), arma la URL. No es un atajo paralelo: es el mismo connect, solo que redirige en vez de devolver JSON.
- `clientId` validado uuid (400 si falta/ inválido).
- **Montado condicionalmente**: el module lo incluye solo si `NODE_ENV !== 'production'`. En prod la ruta **no existe** (no aparece en docs ni responde).

## Endpoint

| Método | Ruta                                  | Auth        | Entorno       |
| ------ | ------------------------------------- | ----------- | ------------- |
| `GET`  | `/v1/_dev/oauth/intuit?clientId=<id>` | `@Public()` | no-production |

→ 302 `Location: https://appcenter.intuit.com/connect/oauth2?...&state=...`

## Alcance

### Sí entra

- `IntuitDevOauthController` (302) + montaje condicional por `NODE_ENV`.
- Unit test (redirige a la URL de connect).

### NO entra

- Otros providers (Microsoft/Dropbox/Google/Square) — son de otros plugins; cada uno tendrá su shortcut si se porta.
- Versión "new client" sin clientId — mapi_v2 es client-first: el client se crea antes.

## Versiones

| Versión | Estado | Tema                         | Tag           | Archivo             |
| ------- | ------ | ---------------------------- | ------------- | ------------------- |
| 0.7.0   | ✅     | shortcut dev-oauth (1 click) | intuit-v0.7.0 | [v0.7.0](v0.7.0.md) |
