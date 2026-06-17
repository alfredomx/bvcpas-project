# BACKLOG — `plugins/intuit`

Cosas diferidas del plugin Intuit, agrupadas por **trigger concreto** (cuándo retomarlas). No es roadmap: es lo que sabemos que falta pero no se construye hasta que toque.

> Regla viva: escrituras contra QBO (mutaciones) **no se hacen hasta que su feature se necesite**, una por una, autorizadas en ese momento. GET-only es el default ([[feedback_solo_get_qbo]]).

## Trigger: cuando se necesite escribir en QBO (mutaciones — excepción a GET-only)

- [ ] **Writeback de memo a QBO** — actualizar el memo/`PrivateNote` de una transacción vía sparse-update (POST a la entidad QBO). Es la "casilla admin" que, al guardar una nota, la escribe también en QuickBooks. Vive como **capacidad de escritura en intuit** (su primer POST a QBO); el frontend compone 2 llamadas (uncats guarda la nota + intuit hace el writeback), síncrono, sin cola. Excepción documentada a GET-only. _Trigger: cuando se arme el flujo de uncats con la opción de escribir a QBO._
- [ ] **Revocar el token en QBO al desconectar** — hoy `DELETE /clients/:id/connection` solo borra la fila local (v0.8.0). Falta llamar el revoke endpoint de Intuit para invalidar también del lado de QBO. _Trigger: cuando importe revocar de verdad, no solo olvidar local._

## Trigger: cuando se arme la persistencia / connectors

- [ ] **Persistencia / CDC / backfill** — hoy las lecturas son read-through (en vivo, sin DB). Cuando se necesite snapshot/histórico en DB: connectors (pull QBO → staging), CDC incremental, cursores, jobs en cola (pipe). _Trigger: cuando un plugin (p.ej. uncats) necesite snapshot persistido, o se quiera histórico consultable._
