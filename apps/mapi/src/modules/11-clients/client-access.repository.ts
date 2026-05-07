import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../core/db/db.module'
import { type UserClientAccess, userClientAccess } from '../../db/schema/user-client-access'

/**
 * Repository para `user_client_access`. Acceso granular por
 * (usuario × cliente). Usado por `ClientAccessGuard`.
 *
 * En v0.8.0 sin endpoint admin: la tabla se llena vía SQL directo o
 * por la migración inicial (D-mapi-023).
 */
@Injectable()
export class ClientAccessRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  /**
   * `true` si el usuario tiene acceso al cliente. Path crítico
   * (corre en cada request a /v1/clients/:id/...). Performance:
   * SELECT 1 con índice de PK compuesta.
   */
  async hasAccess(userId: string, clientId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ one: sql<number>`1` })
      .from(userClientAccess)
      .where(and(eq(userClientAccess.userId, userId), eq(userClientAccess.clientId, clientId)))
      .limit(1)
    return row !== undefined
  }

  /**
   * Lista IDs de clientes a los que un usuario tiene acceso. Usado por
   * `GET /v1/clients` para filtrar la lista.
   */
  async listClientIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ clientId: userClientAccess.clientId })
      .from(userClientAccess)
      .where(eq(userClientAccess.userId, userId))
    return rows.map((r) => r.clientId)
  }

  async grant(userId: string, clientId: string): Promise<UserClientAccess> {
    const [row] = await this.db
      .insert(userClientAccess)
      .values({ userId, clientId })
      .onConflictDoNothing()
      .returning()
    if (!row) {
      // Conflict (ya existía). Devolver la fila existente.
      const [existing] = await this.db
        .select()
        .from(userClientAccess)
        .where(and(eq(userClientAccess.userId, userId), eq(userClientAccess.clientId, clientId)))
        .limit(1)
      if (!existing) throw new Error('grant() falló: ni insert ni read')
      return existing
    }
    return row
  }

  async revoke(userId: string, clientId: string): Promise<void> {
    await this.db
      .delete(userClientAccess)
      .where(and(eq(userClientAccess.userId, userId), eq(userClientAccess.clientId, clientId)))
  }
}
