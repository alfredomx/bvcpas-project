import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../../core/db/db.module'
import { type Client, type NewClient, clients } from '../../../db/schema/clients'

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
  qboRealmId?: string | null
}

/**
 * Repository mínimo para `clients` en v0.3.0 (suficiente para OAuth flow).
 *
 * En v0.4+ entra un módulo `11-clients` con CRUD admin completo; este
 * repository se moverá entonces. Lo dejamos aquí para no introducir
 * dependencias entre módulos antes de tiempo.
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
}
