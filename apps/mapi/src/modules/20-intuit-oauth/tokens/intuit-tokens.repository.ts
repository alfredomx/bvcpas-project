import { Inject, Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../../core/db/db.module'
import { type IntuitToken, intuitTokens } from '../../../db/schema/intuit-tokens'

export interface UpsertTokenData {
  clientId: string
  realmId: string
  accessTokenEncrypted: string
  refreshTokenEncrypted: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
}

export interface RefreshedTokenData {
  accessTokenEncrypted: string
  refreshTokenEncrypted: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
}

@Injectable()
export class IntuitTokensRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async findByClientId(clientId: string): Promise<IntuitToken | null> {
    const [row] = await this.db
      .select()
      .from(intuitTokens)
      .where(eq(intuitTokens.clientId, clientId))
      .limit(1)
    return row ?? null
  }

  async findByRealmId(realmId: string): Promise<IntuitToken | null> {
    const [row] = await this.db
      .select()
      .from(intuitTokens)
      .where(eq(intuitTokens.realmId, realmId))
      .limit(1)
    return row ?? null
  }

  async upsert(data: UpsertTokenData): Promise<IntuitToken> {
    const [row] = await this.db
      .insert(intuitTokens)
      .values({
        clientId: data.clientId,
        realmId: data.realmId,
        accessTokenEncrypted: data.accessTokenEncrypted,
        refreshTokenEncrypted: data.refreshTokenEncrypted,
        accessTokenExpiresAt: data.accessTokenExpiresAt,
        refreshTokenExpiresAt: data.refreshTokenExpiresAt,
      })
      .onConflictDoUpdate({
        target: intuitTokens.clientId,
        set: {
          realmId: data.realmId,
          accessTokenEncrypted: data.accessTokenEncrypted,
          refreshTokenEncrypted: data.refreshTokenEncrypted,
          accessTokenExpiresAt: data.accessTokenExpiresAt,
          refreshTokenExpiresAt: data.refreshTokenExpiresAt,
          updatedAt: new Date(),
        },
      })
      .returning()
    if (!row) throw new Error('IntuitTokensRepository.upsert: no row returned')
    return row
  }

  async updateRefreshed(clientId: string, data: RefreshedTokenData): Promise<IntuitToken | null> {
    const [row] = await this.db
      .update(intuitTokens)
      .set({
        accessTokenEncrypted: data.accessTokenEncrypted,
        refreshTokenEncrypted: data.refreshTokenEncrypted,
        accessTokenExpiresAt: data.accessTokenExpiresAt,
        refreshTokenExpiresAt: data.refreshTokenExpiresAt,
        lastRefreshedAt: sql`now()`,
        updatedAt: new Date(),
      })
      .where(eq(intuitTokens.clientId, clientId))
      .returning()
    return row ?? null
  }

  async deleteByClientId(clientId: string): Promise<void> {
    await this.db.delete(intuitTokens).where(eq(intuitTokens.clientId, clientId))
  }

  async listAll(): Promise<IntuitToken[]> {
    return this.db.select().from(intuitTokens)
  }
}
