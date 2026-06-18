# BACKLOG — `plugins/intuit`

Cosas diferidas del plugin Intuit, agrupadas por **trigger concreto** (cuándo retomarlas). No es roadmap: es lo que sabemos que falta pero no se construye hasta que toque.

> Regla viva: escrituras contra QBO (mutaciones) **no se hacen hasta que su feature se necesite**, una por una, autorizadas en ese momento. GET-only es el default ([[feedback_solo_get_qbo]]).

## Trigger: cuando se necesite escribir en QBO (mutaciones — excepción a GET-only)

- [ ] **Writeback de memo a QBO** — actualizar el memo/`PrivateNote` de una transacción vía sparse-update (POST a la entidad QBO). Es la "casilla admin" que, al guardar una nota, la escribe también en QuickBooks. Vive como **capacidad de escritura en intuit** (su primer POST a QBO); el frontend compone 2 llamadas (uncats guarda la nota + intuit hace el writeback), síncrono, sin cola. Excepción documentada a GET-only. _Trigger: cuando se arme el flujo de uncats con la opción de escribir a QBO._
- [ ] **Revocar el token en QBO al desconectar** — hoy `DELETE /clients/:id/connection` solo borra la fila local (v0.8.0). Falta llamar el revoke endpoint de Intuit para invalidar también del lado de QBO. _Trigger: cuando importe revocar de verdad, no solo olvidar local._

## Trigger: cuando se arme la persistencia / connectors

- [ ] **Persistencia / CDC / backfill** — hoy las lecturas son read-through (en vivo, sin DB). Cuando se necesite snapshot/histórico en DB: connectors (pull QBO → staging), CDC incremental, cursores, jobs en cola (pipe). _Trigger: cuando un plugin (p.ej. uncats) necesite snapshot persistido, o se quiera histórico consultable._

## Trigger: cuando se estandarice el contrato de la API (convención flat + params)

- [ ] **Migrar rutas de intuit a la convención flat** — hoy intuit mete `clientId` en el path (`/v1/intuit/:clientId/...`, `/v1/intuit/clients/:id/...`). La convención adoptada desde `bank-credentials v0.1.0` es: **namespace flat por dominio**, `clientId` NUNCA en el path → filtro query en listas (`?clientId=`) y campo del body en alta/mutación; ops por uuid en `/:id`. Romper estas rutas requiere coordinar con qubot/frontend (cambio de contrato). _Trigger: cuando se unifique el contrato de la API (probablemente al montar Scalar o al conectar el frontend)._ Ver [[feedback_api_route_convention]].
