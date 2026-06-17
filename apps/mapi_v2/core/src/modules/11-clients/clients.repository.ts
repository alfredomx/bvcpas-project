import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, ilike, sql, type SQL } from 'drizzle-orm'
import { DB, type DrizzleDb } from '@/core/db/db.module'
import { clients, type Client, type NewClient } from '@/core/db/schema/clients'

export interface ListClientsParams {
  status?: Client['status']
  search?: string
  limit: number
  offset: number
}

/**
 * Acceso a datos de `clients`. Única puerta a la tabla; los plugins NO la tocan
 * directo, leen vía `ClientsService`.
 */
@Injectable()
export class ClientsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async list(params: ListClientsParams): Promise<{ rows: Client[]; total: number }> {
    const conditions: SQL[] = []
    if (params.status) conditions.push(eq(clients.status, params.status))
    if (params.search) conditions.push(ilike(clients.legalName, `%${params.search}%`))
    const where = conditions.length ? and(...conditions) : undefined

    const rows = await this.db
      .select()
      .from(clients)
      .where(where)
      .orderBy(asc(clients.legalName))
      .limit(params.limit)
      .offset(params.offset)

    const [count] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(clients)
      .where(where)

    return { rows, total: count?.total ?? 0 }
  }

  async findById(id: string): Promise<Client | null> {
    const [row] = await this.db.select().from(clients).where(eq(clients.id, id)).limit(1)
    return row ?? null
  }

  async create(data: NewClient): Promise<Client> {
    const [row] = await this.db.insert(clients).values(data).returning()
    return row
  }

  async update(id: string, data: Partial<NewClient>): Promise<Client | null> {
    const [row] = await this.db
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning()
    return row ?? null
  }
}
