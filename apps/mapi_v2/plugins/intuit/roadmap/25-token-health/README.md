# 25-token-health — salud de tokens + auto-refresh (GET-only)

Mantiene vivos los refresh tokens de Intuit (cron semanal) y expone su **salud** como JSON para que el frontend arme su propio dashboard. **Sin Prometheus** — endpoint, no métrica.

> **Cara pública:** [`../../README.md`](../../README.md). · **Decisiones:** [`../README.md`](../README.md) (`D-intuit-NNN`).

## Por qué

El refresh token de Intuit dura ~100 días pero **se renueva en cada uso**. Conexiones activas ya ruedan solas (refresh transparente en cada call/401); las **inactivas** podrían vencer. Y aunque no venza, conviene ver cuáles necesitan re-OAuth (revocadas, rechazadas). En vez de alertar con un gauge de Prometheus, lo damos como **endpoint JSON** + lo **mantenemos vivo** con un cron.

## Diseño

- **Auto-refresh cron** (`IntuitTokensRefreshCron`): semanal (lunes 03:00), refresca todas las conexiones para que no venzan por inactividad. **No corre en el arranque** (evita rotar todo en cada restart del watch en dev). Requiere que **mapi_v2 sea el único dueño** de los tokens (si otro sistema refresca los mismos realms, se invalidan mutuamente).
- **Flag `needs_reauth`** (columna nueva en `intuit_tokens`): `refresh()` la prende cuando el refresh vence o Intuit lo rechaza; cualquier `save`/refresh exitoso la limpia. Es la señal **real** de "esta conexión necesita re-OAuth" (la fecha sola no detecta revocaciones).
- **Endpoint `/tokens` enriquecido**: agrega `daysUntilRefreshExpiry`, `refreshExpired`, `needsReauth` y un `status` derivado:
  - `ok` · `expiring_soon` (< 14 días) · `needs_reauth` (`needsReauth` o `refreshExpired`).
- **Sin Prometheus**: `@nestjs/schedule` para el cron (importado en el module del plugin, self-contained — no toca el core). El dashboard lo arma el frontend con el JSON.

## Endpoint

`GET /v1/intuit/tokens` (AdminGuard) → `IntuitTokenStatus[]`:

```
{ clientId, realmId, accessTokenExpiresAt, refreshTokenExpiresAt,
  daysUntilRefreshExpiry, refreshExpired, needsReauth, status }
```

## Schema

`intuit_tokens` + columna `needs_reauth boolean NOT NULL DEFAULT false` (migración aditiva).

## Alcance

### Sí entra

- Columna `needs_reauth` + `repo.setNeedsReauth`.
- `refresh()` marca `needs_reauth` al fallar; `save()` lo limpia. `refreshAll()` (para el cron).
- `listStatus()` enriquecido (`daysUntilRefreshExpiry` + `status`).
- `IntuitTokensRefreshCron` (semanal, sin boot) + `ScheduleModule`.
- Unit tests (needs_reauth set/clear, status, refreshAll).

### NO entra (diferido)

- Prometheus / `/metrics` — se usa el endpoint JSON.
- Auto-reconexión sin humano: si `needs_reauth`, requiere re-OAuth (eso es el shortcut dev-oauth / reconnect, otras versiones).

## Versiones

| Versión | Estado | Tema                           | Tag           | Archivo             |
| ------- | ------ | ------------------------------ | ------------- | ------------------- |
| 0.6.0   | ✅     | salud de tokens + auto-refresh | intuit-v0.6.0 | [v0.6.0](v0.6.0.md) |
