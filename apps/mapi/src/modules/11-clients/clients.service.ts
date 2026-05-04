import { Injectable } from '@nestjs/common'
import type { Client, ClientStatus } from '../../db/schema/clients'
import { EventLogService } from '../95-event-log/event-log.service'
import { ClientNotFoundError } from '../20-intuit-oauth/intuit-oauth.errors'
import {
  ClientsRepository,
  type ListClientsFilters,
  type UpdateClientData,
} from './clients.repository'

export interface ListClientsParams {
  page: number
  pageSize: number
  status?: ClientStatus
  search?: string
}

export interface ListClientsResponse {
  items: Client[]
  total: number
  page: number
  pageSize: number
}

const EDITABLE_FIELDS = [
  'legalName',
  'dba',
  'industry',
  'entityType',
  'fiscalYearStart',
  'timezone',
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
      ...(params.search ? { search: params.search } : {}),
    }
    const { items, total } = await this.repo.list(filters)
    return { items, total, page: params.page, pageSize: params.pageSize }
  }

  async getById(id: string): Promise<Client> {
    const row = await this.repo.findById(id)
    if (!row) throw new ClientNotFoundError(id)
    return row
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
