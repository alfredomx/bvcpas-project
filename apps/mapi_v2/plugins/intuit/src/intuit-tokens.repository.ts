import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DB, type DrizzleDb } from '@/core/db/db.module'
import { intuitTokens, type IntuitTokens, type NewIntuitTokens } from './intuit-tokens.schema'

/**
 * Acceso a datos de `intuit_tokens`. Guarda/lee los tokens YA cifrados (el
 * cifrado/descifrado vive en `IntuitTokensService`).
 */
@Injectable()
export class IntuitTokensRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  /** Upsert por `client_id` (1 conexión por cliente). */
  async upsert(data: NewIntuitTokens): Promise<IntuitTokens> {
    const [row] = await this.db
      .insert(intuitTokens)
      .values(data)
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
    return row
  }

  async findByClientId(clientId: string): Promise<IntuitTokens | null> {
    const [row] = await this.db
      .select()
      .from(intuitTokens)
      .where(eq(intuitTokens.clientId, clientId))
      .limit(1)
    return row ?? null
  }

  async findByRealmId(realmId: string): Promise<IntuitTokens | null> {
    const [row] = await this.db
      .select()
      .from(intuitTokens)
      .where(eq(intuitTokens.realmId, realmId))
      .limit(1)
    return row ?? null
  }

  async listAll(): Promise<IntuitTokens[]> {
    return this.db.select().from(intuitTokens)
  }

  async deleteByClientId(clientId: string): Promise<boolean> {
    const rows = await this.db
      .delete(intuitTokens)
      .where(eq(intuitTokens.clientId, clientId))
      .returning({ clientId: intuitTokens.clientId })
    return rows.length > 0
  }
}
