// Tipos del módulo 11-clients.
//
// En v0.3.0 este módulo es mínimo — solo expone los tipos `Client`,
// `ClientTier` y `ClientStatus` para que otros módulos del frontend
// los importen. El consumo real de `GET /v1/clients` entra en
// versiones posteriores cuando una pantalla lo requiera (D-bvcpas-015:
// la sidebar de v0.3.0 consume `customer-support`, no `clients`).
//
// Naming snake_case 1:1 con el backend (D-bvcpas-020). Mapi serializa
// con keys snake_case en `apps/mapi/src/modules/11-clients/clients.controller.ts`.

/**
 * Tier comercial del cliente. Replica `CLIENT_TIERS` del schema de
 * mapi (`apps/mapi/src/db/schema/clients.ts`).
 */
export type ClientTier = 'silver' | 'gold' | 'platinum'

/**
 * Estado operativo del cliente. Replica `CLIENT_STATUSES` del schema
 * de mapi.
 *
 * - `active`: cliente normal, recibe follow-ups.
 * - `paused`: pausado temporalmente, sin follow-ups automáticos.
 * - `offboarded`: dado de baja (soft delete).
 */
export type ClientStatus = 'active' | 'paused' | 'offboarded'

/**
 * Cliente — shape canónico devuelto por `GET /v1/clients` y
 * `GET /v1/clients/:id`. snake_case (D-bvcpas-020).
 */
export interface Client {
  id: string
  legal_name: string
  tier: ClientTier
  status: ClientStatus
  qbo_realm_id: string | null
}
