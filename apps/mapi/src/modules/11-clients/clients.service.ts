import { Injectable } from '@nestjs/common'
import type { Client, ClientStatus, ClientTier } from '../../db/schema/clients'
import { EventLogService } from '../95-event-log/event-log.service'
import { ClientNotFoundError } from './clients.errors'
import {
  ClientsRepository,
  type ListClientsFilters,
  type UpdateClientData,
} from './clients.repository'

export interface ListClientsParams {
  page: number
  pageSize: number
  status?: ClientStatus
  tier?: ClientTier
  search?: string
  /**
   * Filtro de seguridad. Si se pasa, solo se devuelven clientes cuyo
   * id está en este array (típicamente, los user_client_access del
   * usuario actual). Si está presente y vacío → respuesta vacía.
   */
  allowedClientIds?: readonly string[]
}

export interface ListClientsResponse {
  items: Client[]
  total: number
  page: number
  pageSize: number
}

/**
 * Resultado de resolver una referencia difusa a un cliente:
 * - `resolved`: un solo cliente (por alias exacto o por match único de nombre).
 * - `ambiguous`: varios candidatos — el caller elige y luego confirma el alias.
 * - `not_found`: ningún cliente coincide.
 */
export type ResolveClientResult =
  | { status: 'resolved'; via: 'alias' | 'match'; client: Client }
  | { status: 'ambiguous'; candidates: Client[] }
  | { status: 'not_found' }

/** Cuántos candidatos máximo devolver en el caso ambiguo. */
const RESOLVE_CANDIDATES_LIMIT = 10

const EDITABLE_FIELDS = [
  'legalName',
  'dba',
  'industry',
  'entityType',
  'fiscalYearStart',
  'timezone',
  'tier',
  'draftEmailEnabled',
  'transactionsFilter',
  'ccEmail',
  'primaryContactName',
  'primaryContactEmail',
  'notes',
] as const satisfies readonly (keyof UpdateClientData)[]

type EditableField = (typeof EDITABLE_FIELDS)[number]
type EditablePayload = Partial<Pick<UpdateClientData, EditableField>>

/**
 * Service del módulo 11-clients. Encapsula la lógica de:
 * - Listar con paginación + filtros (status, search por legalName).
 * - Get por id (lanza ClientNotFoundError si no existe).
 * - Update parcial limitado a campos editables — emite `client.updated` con
 *   la lista de campos cambiados (no values, para no hacer leak de PII en
 *   event_log más allá de lo necesario para auditoría).
 * - Change status (active/paused/offboarded). Idempotente: si el nuevo
 *   status es igual al actual, no escribe ni emite.
 *
 * No expone `create` — los clientes nacen vía OAuth callback en el módulo
 * 20-intuit-oauth, no por CRUD admin.
 */
@Injectable()
export class ClientsService {
  constructor(
    private readonly repo: ClientsRepository,
    private readonly events: EventLogService,
  ) {}

  async list(params: ListClientsParams): Promise<ListClientsResponse> {
    const filters: ListClientsFilters = {
      page: params.page,
      pageSize: params.pageSize,
      ...(params.status ? { status: params.status } : {}),
      ...(params.tier ? { tier: params.tier } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.allowedClientIds !== undefined
        ? { allowedClientIds: params.allowedClientIds }
        : {}),
    }
    const { items, total } = await this.repo.list(filters)
    return { items, total, page: params.page, pageSize: params.pageSize }
  }

  async getById(id: string): Promise<Client> {
    const row = await this.repo.findById(id)
    if (!row) throw new ClientNotFoundError(id)
    return row
  }

  /**
   * Resuelve una referencia difusa (`q`) a un cliente, en este orden:
   *   1. Alias guardado exacto → resuelve directo (sin preguntar).
   *   2. Si no hay alias: match difuso por `legal_name`.
   *      - exactamente 1 → resuelto.
   *      - varios → ambiguo (el caller elige y confirma).
   *      - 0 → no encontrado.
   */
  async resolve(q: string): Promise<ResolveClientResult> {
    const normalized = q.trim().toLowerCase()

    const byAlias = await this.repo.findByAlias(normalized)
    if (byAlias) return { status: 'resolved', via: 'alias', client: byAlias }

    const matches = await this.repo.searchByLegalName(q.trim(), RESOLVE_CANDIDATES_LIMIT + 1)
    if (matches.length === 0) return { status: 'not_found' }
    if (matches.length === 1) return { status: 'resolved', via: 'match', client: matches[0] }
    return { status: 'ambiguous', candidates: matches.slice(0, RESOLVE_CANDIDATES_LIMIT) }
  }

  /**
   * Guarda un alias → cliente en el diccionario. El alias se normaliza a
   * minúsculas. Si el cliente no existe, lanza ClientNotFoundError.
   * La próxima vez que `resolve` reciba ese alias, pega directo.
   */
  async confirmAlias(alias: string, clientId: string): Promise<{ alias: string; client: Client }> {
    const client = await this.repo.findById(clientId)
    if (!client) throw new ClientNotFoundError(clientId)

    const normalized = alias.trim().toLowerCase()
    await this.repo.upsertAlias(normalized, clientId)
    return { alias: normalized, client }
  }

  async update(id: string, payload: EditablePayload, actorUserId: string): Promise<Client> {
    const before = await this.repo.findById(id)
    if (!before) throw new ClientNotFoundError(id)

    const sanitized: EditablePayload = {}
    for (const field of EDITABLE_FIELDS) {
      if (field in payload) {
        ;(sanitized as Record<string, unknown>)[field] = payload[field]
      }
    }

    const after = await this.repo.update(id, sanitized)
    if (!after) throw new ClientNotFoundError(id)

    const changedFields = Object.keys(sanitized).filter((k) => {
      const beforeVal = (before as unknown as Record<string, unknown>)[k]
      const afterVal = (sanitized as Record<string, unknown>)[k]
      return beforeVal !== afterVal
    })

    if (changedFields.length > 0) {
      await this.events.log('client.updated', { clientId: id, changedFields }, actorUserId, {
        type: 'client',
        id,
      })
    }

    return after
  }

  async changeStatus(id: string, newStatus: ClientStatus, actorUserId: string): Promise<Client> {
    const before = await this.repo.findById(id)
    if (!before) throw new ClientNotFoundError(id)

    if (before.status === newStatus) {
      return before
    }

    const after = await this.repo.update(id, { status: newStatus })
    if (!after) throw new ClientNotFoundError(id)

    await this.events.log(
      'client.status_changed',
      { clientId: id, fromStatus: before.status, toStatus: newStatus },
      actorUserId,
      { type: 'client', id },
    )

    return after
  }
}
