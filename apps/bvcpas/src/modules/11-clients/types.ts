// Tipos del módulo 11-clients.
//
// v0.4.0 (D-bvcpas-028): los tipos se derivan del SDK tipado para
// que sean siempre el reflejo del OpenAPI de mapi. snake_case 1:1
// con el backend (D-bvcpas-020).

import type { components } from '@/lib/api/schema'

/** Cliente — shape canónico devuelto por `GET /v1/clients`. */
export type Client = components['schemas']['ClientDto']

export type ClientStatus = Client['status']
export type ClientTier = Client['tier']
