import { Inject, Injectable } from '@nestjs/common'
import { and, eq, inArray } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../../core/db/db.module'
import { userConnections, type UserConnection } from '../../../db/schema/user-connections'

/**
 * Repo del dashboard de integraciones (v0.14.0).
 *
 * Filtra siempre por providers que aplican al scope cliente: Clover y Square.
 * Los providers globales (Intuit, Microsoft, Dropbox, Google) viven en otra
 * vista futura aparte.
 */
const CLIENT_SCOPED_PROVIDERS = ['clover', 'square'] as const

@Injectable()
export class IntegrationsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async listByClient(clientId: string): Promise<UserConnection[]> {
    return this.db
      .select()
      .from(userConnections)
      .where(
        and(
          eq(userConnections.clientId, clientId),
          inArray(userConnections.provider, [...CLIENT_SCOPED_PROVIDERS]),
        ),
      )
  }
}
