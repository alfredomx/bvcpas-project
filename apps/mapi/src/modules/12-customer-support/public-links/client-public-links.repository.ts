import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../../core/db/db.module'
import {
  type ClientPublicLink,
  type NewClientPublicLink,
  type PublicLinkPurpose,
  clientPublicLinks,
} from '../../../db/schema/client-public-links'

@Injectable()
export class ClientPublicLinksRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async findActiveByClientAndPurpose(
    clientId: string,
    purpose: PublicLinkPurpose,
  ): Promise<ClientPublicLink | null> {
    const [row] = await this.db
      .select()
      .from(clientPublicLinks)
      .where(
        and(
          eq(clientPublicLinks.clientId, clientId),
          eq(clientPublicLinks.purpose, purpose),
          isNull(clientPublicLinks.revokedAt),
        ),
      )
      .orderBy(desc(clientPublicLinks.createdAt))
      .limit(1)
    return row ?? null
  }

  /** Devuelve el link más reciente del cliente para ese purpose, sin
   * filtrar por revocación. Útil cuando la UI necesita mostrar el link
   * aunque esté revocado (para ofrecer "anular revocación"). */
  async findLatestByClientAndPurpose(
    clientId: string,
    purpose: PublicLinkPurpose,
  ): Promise<ClientPublicLink | null> {
    const [row] = await this.db
      .select()
      .from(clientPublicLinks)
      .where(and(eq(clientPublicLinks.clientId, clientId), eq(clientPublicLinks.purpose, purpose)))
      .orderBy(desc(clientPublicLinks.createdAt))
      .limit(1)
    return row ?? null
  }

  async findByToken(token: string): Promise<ClientPublicLink | null> {
    const [row] = await this.db
      .select()
      .from(clientPublicLinks)
      .where(eq(clientPublicLinks.token, token))
      .limit(1)
    return row ?? null
  }

  async findById(id: string): Promise<ClientPublicLink | null> {
    const [row] = await this.db
      .select()
      .from(clientPublicLinks)
      .where(eq(clientPublicLinks.id, id))
      .limit(1)
    return row ?? null
  }

  async create(data: NewClientPublicLink): Promise<ClientPublicLink> {
    const [row] = await this.db.insert(clientPublicLinks).values(data).returning()
    if (!row) throw new Error('create: no row returned')
    return row
  }

  async revoke(id: string): Promise<void> {
    await this.db
      .update(clientPublicLinks)
      .set({ revokedAt: new Date() })
      .where(eq(clientPublicLinks.id, id))
  }

  /** Update parcial. Solo aplica los campos presentes (undefined se ignora).
   * Para anular revocación: pasar `revokedAt: null`. */
  async update(
    id: string,
    patch: {
      expiresAt?: Date | null
      maxUses?: number | null
      metadata?: Record<string, unknown> | null
      revokedAt?: Date | null
    },
  ): Promise<ClientPublicLink | null> {
    const set: Record<string, unknown> = {}
    if (patch.expiresAt !== undefined) set.expiresAt = patch.expiresAt
    if (patch.maxUses !== undefined) set.maxUses = patch.maxUses
    if (patch.metadata !== undefined) set.metadata = patch.metadata
    if (patch.revokedAt !== undefined) set.revokedAt = patch.revokedAt
    if (Object.keys(set).length === 0) return this.findById(id)
    const [row] = await this.db
      .update(clientPublicLinks)
      .set(set)
      .where(eq(clientPublicLinks.id, id))
      .returning()
    return row ?? null
  }

  async incrementUseCount(id: string): Promise<void> {
    await this.db
      .update(clientPublicLinks)
      .set({
        useCount: sql`${clientPublicLinks.useCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(clientPublicLinks.id, id))
  }

  async listByClient(clientId: string): Promise<ClientPublicLink[]> {
    return this.db
      .select()
      .from(clientPublicLinks)
      .where(eq(clientPublicLinks.clientId, clientId))
      .orderBy(desc(clientPublicLinks.createdAt))
  }
}
