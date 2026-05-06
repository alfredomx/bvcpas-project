import { Inject, Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../../core/db/db.module'
import {
  type UserMicrosoftToken,
  userMicrosoftTokens,
} from '../../../db/schema/user-microsoft-tokens'

export interface UpsertMicrosoftTokenData {
  userId: string
  microsoftUserId: string
  email: string
  scopes: string
  accessTokenEncrypted: string
  refreshTokenEncrypted: string
  accessTokenExpiresAt: Date
}

export interface RefreshedMicrosoftTokenData {
  accessTokenEncrypted: string
  refreshTokenEncrypted: string
  accessTokenExpiresAt: Date
}

@Injectable()
export class MicrosoftTokensRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async findByUserId(userId: string): Promise<UserMicrosoftToken | null> {
    const [row] = await this.db
      .select()
      .from(userMicrosoftTokens)
      .where(eq(userMicrosoftTokens.userId, userId))
      .limit(1)
    return row ?? null
  }

  async upsert(data: UpsertMicrosoftTokenData): Promise<UserMicrosoftToken> {
    const [row] = await this.db
      .insert(userMicrosoftTokens)
      .values({
        userId: data.userId,
        microsoftUserId: data.microsoftUserId,
        email: data.email,
        scopes: data.scopes,
        accessTokenEncrypted: data.accessTokenEncrypted,
        refreshTokenEncrypted: data.refreshTokenEncrypted,
        accessTokenExpiresAt: data.accessTokenExpiresAt,
      })
      .onConflictDoUpdate({
        target: userMicrosoftTokens.userId,
        set: {
          microsoftUserId: data.microsoftUserId,
          email: data.email,
          scopes: data.scopes,
          accessTokenEncrypted: data.accessTokenEncrypted,
          refreshTokenEncrypted: data.refreshTokenEncrypted,
          accessTokenExpiresAt: data.accessTokenExpiresAt,
          updatedAt: new Date(),
        },
      })
      .returning()
    if (!row) throw new Error('MicrosoftTokensRepository.upsert: no row returned')
    return row
  }

  async updateRefreshed(
    userId: string,
    data: RefreshedMicrosoftTokenData,
  ): Promise<UserMicrosoftToken | null> {
    const [row] = await this.db
      .update(userMicrosoftTokens)
      .set({
        accessTokenEncrypted: data.accessTokenEncrypted,
        refreshTokenEncrypted: data.refreshTokenEncrypted,
        accessTokenExpiresAt: data.accessTokenExpiresAt,
        lastRefreshedAt: sql`now()`,
        updatedAt: new Date(),
      })
      .where(eq(userMicrosoftTokens.userId, userId))
      .returning()
    return row ?? null
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.delete(userMicrosoftTokens).where(eq(userMicrosoftTokens.userId, userId))
  }
}
