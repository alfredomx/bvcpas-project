import { Inject, Injectable } from '@nestjs/common'
import { and, eq, ilike, or, type SQL } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../core/db/db.module'
import { clients } from '../../db/schema/clients'
import { bankPortals } from '../../db/schema/bank-portals'
import {
  clientBankAccounts,
  type ClientBankAccount,
  type ClientBankAccountStatus,
  type NewClientBankAccount,
} from '../../db/schema/client-bank-accounts'

export interface ListGlobalFilters {
  clientId?: string
  portalId?: string
  status?: ClientBankAccountStatus
  search?: string
  limit?: number
  offset?: number
}

export interface GlobalCredentialRow {
  credential: ClientBankAccount
  client: { id: string; legal_name: string }
  portal: { id: string; name: string; portal_url: string | null }
}

/** Credencial per-cliente con su portal joineado (v0.28.1). */
export interface ClientCredentialRow {
  credential: ClientBankAccount
  portal: { id: string; name: string; portal_url: string | null }
}

@Injectable()
export class ClientBankAccountsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async listByClient(clientId: string): Promise<ClientBankAccount[]> {
    return this.db
      .select()
      .from(clientBankAccounts)
      .where(eq(clientBankAccounts.clientId, clientId))
      .orderBy(clientBankAccounts.createdAt)
  }

  async findById(id: string, clientId: string): Promise<ClientBankAccount | null> {
    const [row] = await this.db
      .select()
      .from(clientBankAccounts)
      .where(and(eq(clientBankAccounts.id, id), eq(clientBankAccounts.clientId, clientId)))
      .limit(1)
    return row ?? null
  }

  // ───── Lectura per-cliente con portal joineado — v0.28.1 ─────────────

  /**
   * Lista credenciales de un cliente con su portal (nombre incluido).
   * Filtro opcional `portalTerm`: match parcial case-insensitive sobre
   * `bank_portals.name` (mismo ilike del `search` global) → D-mapi-BW-032.
   */
  async listByClientWithPortal(
    clientId: string,
    portalTerm?: string,
  ): Promise<ClientCredentialRow[]> {
    const conditions: SQL[] = [eq(clientBankAccounts.clientId, clientId)]
    if (portalTerm && portalTerm.trim().length > 0) {
      conditions.push(ilike(bankPortals.name, `%${portalTerm.trim()}%`))
    }

    const rows = await this.db
      .select({
        credential: clientBankAccounts,
        portal_id: bankPortals.id,
        portal_name: bankPortals.name,
        portal_url: bankPortals.portalUrl,
      })
      .from(clientBankAccounts)
      .innerJoin(bankPortals, eq(clientBankAccounts.bankPortalId, bankPortals.id))
      .where(and(...conditions))
      .orderBy(bankPortals.name, clientBankAccounts.createdAt)

    return rows.map((r) => ({
      credential: r.credential,
      portal: { id: r.portal_id, name: r.portal_name, portal_url: r.portal_url },
    }))
  }

  async findByIdWithPortal(id: string, clientId: string): Promise<ClientCredentialRow | null> {
    const [r] = await this.db
      .select({
        credential: clientBankAccounts,
        portal_id: bankPortals.id,
        portal_name: bankPortals.name,
        portal_url: bankPortals.portalUrl,
      })
      .from(clientBankAccounts)
      .innerJoin(bankPortals, eq(clientBankAccounts.bankPortalId, bankPortals.id))
      .where(and(eq(clientBankAccounts.id, id), eq(clientBankAccounts.clientId, clientId)))
      .limit(1)
    if (!r) return null
    return {
      credential: r.credential,
      portal: { id: r.portal_id, name: r.portal_name, portal_url: r.portal_url },
    }
  }

  async create(data: NewClientBankAccount): Promise<ClientBankAccount> {
    const [row] = await this.db.insert(clientBankAccounts).values(data).returning()
    if (!row) throw new Error('create: no row returned')
    return row
  }

  async update(
    id: string,
    clientId: string,
    patch: Partial<NewClientBankAccount>,
  ): Promise<ClientBankAccount | null> {
    const [row] = await this.db
      .update(clientBankAccounts)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(clientBankAccounts.id, id), eq(clientBankAccounts.clientId, clientId)))
      .returning()
    return row ?? null
  }

  async delete(id: string, clientId: string): Promise<boolean> {
    const result = await this.db
      .delete(clientBankAccounts)
      .where(and(eq(clientBankAccounts.id, id), eq(clientBankAccounts.clientId, clientId)))
      .returning({ id: clientBankAccounts.id })
    return result.length > 0
  }

  // ───── Métodos GLOBALES (sin filtrar por clientId) — v0.16.1 ─────────

  async findByIdGlobal(id: string): Promise<ClientBankAccount | null> {
    const [row] = await this.db
      .select()
      .from(clientBankAccounts)
      .where(eq(clientBankAccounts.id, id))
      .limit(1)
    return row ?? null
  }

  async updateGlobal(
    id: string,
    patch: Partial<NewClientBankAccount>,
  ): Promise<ClientBankAccount | null> {
    const [row] = await this.db
      .update(clientBankAccounts)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(clientBankAccounts.id, id))
      .returning()
    return row ?? null
  }

  async deleteGlobal(id: string): Promise<boolean> {
    const result = await this.db
      .delete(clientBankAccounts)
      .where(eq(clientBankAccounts.id, id))
      .returning({ id: clientBankAccounts.id })
    return result.length > 0
  }

  async listGlobalWithJoins(filters: ListGlobalFilters): Promise<{
    items: GlobalCredentialRow[]
    total: number
  }> {
    const conditions: SQL[] = []
    if (filters.clientId) conditions.push(eq(clientBankAccounts.clientId, filters.clientId))
    if (filters.portalId) conditions.push(eq(clientBankAccounts.bankPortalId, filters.portalId))
    if (filters.status) conditions.push(eq(clientBankAccounts.status, filters.status))
    if (filters.search && filters.search.trim().length > 0) {
      const term = `%${filters.search.trim()}%`
      const searchCond = or(
        ilike(clients.legalName, term),
        ilike(bankPortals.name, term),
        ilike(clientBankAccounts.notes, term),
      )
      if (searchCond) conditions.push(searchCond)
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const limit = filters.limit ?? 200
    const offset = filters.offset ?? 0

    const rows = await this.db
      .select({
        credential: clientBankAccounts,
        client_id: clients.id,
        client_legal_name: clients.legalName,
        portal_id: bankPortals.id,
        portal_name: bankPortals.name,
        portal_url: bankPortals.portalUrl,
      })
      .from(clientBankAccounts)
      .innerJoin(clients, eq(clientBankAccounts.clientId, clients.id))
      .innerJoin(bankPortals, eq(clientBankAccounts.bankPortalId, bankPortals.id))
      .where(whereClause)
      .orderBy(clients.legalName, bankPortals.name)
      .limit(limit)
      .offset(offset)

    const items: GlobalCredentialRow[] = rows.map((r) => ({
      credential: r.credential,
      client: { id: r.client_id, legal_name: r.client_legal_name },
      portal: { id: r.portal_id, name: r.portal_name, portal_url: r.portal_url },
    }))

    const totalRows = await this.db
      .select({ id: clientBankAccounts.id })
      .from(clientBankAccounts)
      .innerJoin(clients, eq(clientBankAccounts.clientId, clients.id))
      .innerJoin(bankPortals, eq(clientBankAccounts.bankPortalId, bankPortals.id))
      .where(whereClause)
    const total = totalRows.length

    return { items, total }
  }
}
