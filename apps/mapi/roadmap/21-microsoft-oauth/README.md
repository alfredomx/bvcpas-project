# 21-microsoft-oauth — Outlook OAuth (Microsoft Graph) por usuario

Integración con Microsoft Graph para que cada operador conecte **su propia
cuenta Outlook** y envíe correos en su nombre. Mismo patrón que
`20-intuit-oauth` pero con dos diferencias clave:

- **Por usuario, no por cliente**: 1 user = 1 Outlook conectado.
- **Multitenant + cuentas personales**: la app de Azure acepta cuentas
  empresariales (Entra ID) y personales (`@outlook.com`, `@hotmail.com`).

## Versiones

| Versión             | Estado | Resumen                                                                     |
| ------------------- | ------ | --------------------------------------------------------------------------- |
| [v0.6.2](v0.6.2.md) | ✅     | OAuth conectar/desconectar + endpoint test-email                            |
| v0.7.0 (siguiente)  | -      | Refactor a módulo `21-connections` genérico (multi-cuenta + multi-provider) |
