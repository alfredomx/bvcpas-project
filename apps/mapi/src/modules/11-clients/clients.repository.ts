import { Inject, Injectable } from '@nestjs/common'
import { and, asc, count, eq, ilike, type SQL } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../core/db/db.module'
import {
  CLIENT_STATUSES,
  type Client,
  type ClientStatus,
  type ClientTier,
  type NewClient,
  clients,
} from '../../db/schema/clients'

export interface CreateClientData {
  legalName: string
  dba?: string | null
  qboRealmId?: string | null
  fiscalYearStart?: number | null
  primaryContactEmail?: string | null
  metadata?: Record<string, unknown> | null
}

export interface UpdateClientData {
  legalName?: string
  dba?: string | null
  qboRealmId?: string | null
  industry?: string | null
  entityType?: string | null
  fiscalYearStart?: number | null
  timezone?: string | null
  status?: ClientStatus
  tier?: ClientTier
  primaryContactName?: string | null
  primaryContactEmail?: string | null
  notes?: string | null
}

export interface ListClientsFilters {
  page: number
  pageSize: number
  status?: ClientStatus
  tier?: ClientTier
  search?: string
}

export interface ListClientsResult {
  items: Client[]
  total: number
}

/**
 * Repository de `clients`. Vive bajo el módulo 11-clients que coordina el
 * CRUD admin, pero el schema mismo (tabla y migration) entró con
 * 20-intuit-oauth v0.3.0 porque clients sin tokens Intuit no tiene sentido
 * operativo.
 */
@Injectable()
export class ClientsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async findById(id: string): Promise<Client | null> {
    const [row] = await this.db.select().from(clients).where(eq(clients.id, id)).limit(1)
    return row ?? null
  }

  async findByRealmId(realmId: string): Promise<Client | null> {
    const [row] = await this.db
      .select()
      .from(clients)
      .where(eq(clients.qboRealmId, realmId))
      .limit(1)
    return row ?? null
  }

  async create(data: CreateClientData): Promise<Client> {
    const insertData: NewClient = {
      legalName: data.legalName,
      dba: data.dba ?? null,
      qboRealmId: data.qboRealmId ?? null,
      fiscalYearStart: data.fiscalYearStart ?? null,
      primaryContactEmail: data.primaryContactEmail ?? null,
      metadata: data.metadata ?? null,
    }
    const [row] = await this.db.insert(clients).values(insertData).returning()
    if (!row) throw new Error('ClientsRepository.create: no row returned')
    return row
  }

  async update(id: string, data: UpdateClientData): Promise<Client | null> {
    const [row] = await this.db
      .update(clients)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, id))
      .returning()
    return row ?? null
  }

  async list(filters: ListClientsFilters): Promise<ListClientsResult> {
    const conditions: SQL[] = []
    if (filters.status) {
      conditions.push(eq(clients.status, filters.status))
    }
    if (filters.tier) {
      conditions.push(eq(clients.tier, filters.tier))
    }
    if (filters.search) {
      conditions.push(ilike(clients.legalName, `%${filters.search}%`))
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const offset = (filters.page - 1) * filters.pageSize

    const [items, totalRow] = await Promise.all([
      this.db
        .select()
        .from(clients)
        .where(where)
        .orderBy(asc(clients.legalName))
        .limit(filters.pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(clients)
        .where(where)
        .then((rows) => rows[0]),
    ])

    return {
      items,
      total: totalRow?.count ?? 0,
    }
  }
}

export const _CLIENT_STATUSES = CLIENT_STATUSES // re-export por conveniencia para DTOs
