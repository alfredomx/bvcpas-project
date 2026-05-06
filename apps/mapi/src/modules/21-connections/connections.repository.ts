import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../core/db/db.module'
import {
  type Provider,
  type UserConnection,
  userConnections,
} from '../../db/schema/user-connections'

export interface UpsertConnectionData {
  userId: string
  provider: Provider
  externalAccountId: string
  email: string | null
  label: string | null
  scopes: string
  accessTokenEncrypted: string
  refreshTokenEncrypted: string | null
  accessTokenExpiresAt: Date
  metadata?: Record<string, unknown> | null
}

export interface ListByUserFilters {
  provider?: Provider
}

@Injectable()
export class ConnectionsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async findByIdForUser(connectionId: string, userId: string): Promise<UserConnection | null> {
    const [row] = await this.db
      .select()
      .from(userConnections)
      .where(and(eq(userConnections.id, connectionId), eq(userConnections.userId, userId)))
      .limit(1)
    return row ?? null
  }

  async listByUser(userId: string, filters: ListByUserFilters = {}): Promise<UserConnection[]> {
    const conditions = [eq(userConnections.userId, userId)]
    if (filters.provider) conditions.push(eq(userConnections.provider, filters.provider))
    return this.db
      .select()
      .from(userConnections)
      .where(and(...conditions))
  }

  async upsert(data: UpsertConnectionData): Promise<UserConnection> {
    const [row] = await this.db
      .insert(userConnections)
      .values({
        userId: data.userId,
        provider: data.provider,
        externalAccountId: data.externalAccountId,
        email: data.email,
        label: data.label,
        scopes: data.scopes,
        accessTokenEncrypted: data.accessTokenEncrypted,
        refreshTokenEncrypted: data.refreshTokenEncrypted,
        accessTokenExpiresAt: data.accessTokenExpiresAt,
        metadata: data.metadata ?? null,
      })
      .onConflictDoUpdate({
        target: [
          userConnections.userId,
          userConnections.provider,
          userConnections.externalAccountId,
        ],
        set: {
          email: data.email,
          label: data.label,
          scopes: data.scopes,
          accessTokenEncrypted: data.accessTokenEncrypted,
          refreshTokenEncrypted: data.refreshTokenEncrypted,
          accessTokenExpiresAt: data.accessTokenExpiresAt,
          metadata: data.metadata ?? null,
          lastRefreshedAt: sql`now()`,
          updatedAt: new Date(),
        },
      })
      .returning()
    if (!row) throw new Error('ConnectionsRepository.upsert: no row returned')
    return row
  }

  async deleteByIdForUser(connectionId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(userConnections)
      .where(and(eq(userConnections.id, connectionId), eq(userConnections.userId, userId)))
      .returning({ id: userConnections.id })
    return result.length > 0
  }

  async updateLabelForUser(
    connectionId: string,
    userId: string,
    label: string | null,
  ): Promise<UserConnection | null> {
    const [row] = await this.db
      .update(userConnections)
      .set({ label, updatedAt: new Date() })
      .where(and(eq(userConnections.id, connectionId), eq(userConnections.userId, userId)))
      .returning()
    return row ?? null
  }
}
