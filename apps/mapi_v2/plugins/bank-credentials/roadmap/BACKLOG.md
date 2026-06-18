# BACKLOG — `plugins/bank-credentials`

Diferidos del plugin, agrupados por **trigger concreto**. No es roadmap: es lo que sabemos que falta pero no se construye hasta que toque.

## Trigger: cuando el core tenga `event_log`

- [ ] **Emitir eventos de auditoría** — `bank_credential.created` / `.credentials_updated` / `.status_changed` / `.deleted`, `bank_account.*`, `bank_portal.created`. El mapi viejo los emitía vía `EventLogService`, pero mapi*v2 aún no porta esa infra al core (D-bank-004). \_Trigger: cuando se monte un `event_log` en el core (lo necesitarán varios plugins).*

## Trigger: cuando se arme el flujo de descarga

- [ ] **Worker de descarga de transacciones** — NO vive en este plugin. Bajar movimientos de los bancos usando estas credenciales es trabajo de la extensión de Chrome (qubot), que abre sesión y consume las APIs internas. Este plugin solo **guarda** las credenciales. _Trigger: cuando se conecte qubot al backend para descargar._

## Trigger: cuando se necesite más granularidad de acceso

- [ ] **Compartir credenciales / control de quién ve qué** — hoy todo es `@Roles('admin')`. Si entra el modelo de acceso por usuario/tier (como en el mapi viejo y connections), las credenciales podrían filtrarse por acceso. _Trigger: cuando haya roles más finos que admin/viewer._
