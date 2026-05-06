# 21-connections — Conexiones a servicios externos por usuario

Módulo genérico que reemplaza a `21-microsoft-oauth` (cerrado en v0.6.2).
Cada usuario puede tener **N conexiones** a **M proveedores**: Microsoft
(Outlook), Google (Gmail/Drive), Dropbox, etc. Cada conexión guarda sus
propios tokens cifrados con `EncryptionService` (AES-256-GCM) y se
refresca on-demand.

Inspirado en el módulo de "Credentials" de n8n: el módulo de Conexiones
es el **núcleo**, y cada provider es un **plugin** dentro de
`providers/<nombre>/`. Cuando una feature (followups, sync, etc.)
necesita un servicio externo, recibe un `connectionId` y delega al
provider correspondiente.

## Versiones

| Versión             | Estado | Resumen                                                                                                                                    |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [v0.7.0](v0.7.0.md) | ✅     | Refactor: tabla genérica `user_connections`, módulo `21-connections` con `providers/microsoft/`. Borra `21-microsoft-oauth/` por completo. |
| v0.7.1 (futuro)     | -      | Provider Google (Gmail + Drive)                                                                                                            |
| v0.7.2 (futuro)     | -      | Provider Dropbox                                                                                                                           |

## Estructura del módulo

```
src/modules/21-connections/
├── connections.module.ts
├── connections.controller.ts          ← endpoints genéricos /v1/connections/*
├── connections.repository.ts
├── connections.service.ts             ← upsert/delete/list tokens cifrados
├── connection-token-refresh.service.ts ← refresh genérico (delega al provider)
├── connection.errors.ts
└── providers/
    ├── provider.interface.ts          ← contrato: refresh(), getProfile(), test()
    └── microsoft/
        ├── microsoft.controller.ts    ← /v1/connections/microsoft/connect + /callback
        ├── microsoft.service.ts       ← buildAuthorizationUrl, exchangeCode, fetchGraphMe
        ├── microsoft.provider.ts      ← implementa provider.interface
        └── graph-mail.service.ts      ← sendMail vía Graph (test() lo invoca)
```

## Decisiones globales del módulo

- **Tabla genérica**: `user_connections` con `provider TEXT` enum,
  `external_account_id` único por (user, provider).
- **Multi-cuenta**: 1 user puede tener 2+ rows del mismo provider (ej: 2
  Outlooks). UNIQUE en `(user_id, provider, external_account_id)` evita
  duplicados de la misma cuenta.
- **Provider plugin pattern**: cada provider implementa `IProvider` con
  3 métodos: `refresh()`, `getProfile()`, `test()`. El core del módulo
  no sabe nada de cada API específica.
- **Endpoints genéricos** para gestión (`GET /connections`, `DELETE
/connections/:id`, `POST /connections/:id/test`).
- **Endpoints específicos por provider** SOLO para OAuth (`POST
/connections/microsoft/connect`, `GET /connections/microsoft/callback`).
- **Ownership scoping**: toda operación valida que la connection
  pertenece al `userId` del JWT. Cross-user access devuelve 404, nunca 403.
