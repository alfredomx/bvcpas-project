# Módulo `20-intuit-oauth` (plugin intuit)

> Conexión a QuickBooks Online: OAuth, tokens (encriptados, con refresh transparente) y un proxy genérico a la API V3 de Intuit. Es la base de la que cuelgan los connectors/CDC futuros.

> **Roadmap del plugin:** [`../README.md`](../README.md) · **Arquitectura:** [`../../../../README.md`](../../../../README.md).

## Qué resuelve

Que el operador pueda **conectar la cuenta QBO de un cliente** (OAuth) y que mapi_v2 pueda **llamar la API de Intuit a su nombre** sin preocuparse por tokens vencidos (refresh automático). Sin esto, no hay forma de leer datos de QuickBooks.

## Cómo se inserta en el core

- Exporta un `ModuleDef` (`{ name: 'intuit', type: 'plugin', module, config }`) desde `plugins/intuit/src/index.ts`; se agrega al `REGISTRY` del core.
- **Consume del core:** `ClientsService` (validar/leer el client), `EncryptionService` (cifrar tokens), `REDIS_CLIENT` (state OAuth), config, `AdminGuard` (protege rutas).
- **Dueño de:** tabla `intuit_tokens` + su migración, config `INTUIT_*` (Zod propio, validado al boot por el registro), sus errores de dominio, sus rutas bajo `/v1/intuit`.

## Versiones

| Versión | Estado | Tema                                           |
| ------- | ------ | ---------------------------------------------- |
| v0.1.0  | 🚧     | OAuth client-first + tokens + IntuitApiService |
