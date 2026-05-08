import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../core/db/db.module'
import {
  type ConnectionAccess,
  type ConnectionPermission,
  connectionAccess,
} from '../../db/schema/connection-access'
import { users } from '../../db/schema/users'

export interface ShareWithUser {
  connectionId: string
  userId: string
  permission: ConnectionPermission
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    email: string
    fullName: string
  }
}

@Injectable()
export class ConnectionAccessRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async findByConnectionAndUser(
    connectionId: string,
    userId: string,
  ): Promise<ConnectionAccess | null> {
    const [row] = await this.db
      .select()
      .from(connectionAccess)
      .where(
        and(eq(connectionAccess.connectionId, connectionId), eq(connectionAccess.userId, userId)),
      )
      .limit(1)
    return row ?? null
  }

  async listByConnection(connectionId: string): Promise<ShareWithUser[]> {
    const rows = await this.db
      .select({
        connectionId: connectionAccess.connectionId,
        userId: connectionAccess.userId,
        permission: connectionAccess.permission,
        createdAt: connectionAccess.createdAt,
        updatedAt: connectionAccess.updatedAt,
        userIdJoined: users.id,
        email: users.email,
        fullName: users.fullName,
      })
      .from(connectionAccess)
      .innerJoin(users, eq(connectionAccess.userId, users.id))
      .where(eq(connectionAccess.connectionId, connectionId))
    return rows.map((r) => ({
      connectionId: r.connectionId,
      userId: r.userId,
      permission: r.permission as ConnectionPermission,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      user: {
        id: r.userIdJoined,
        email: r.email,
        fullName: r.fullName,
      },
    }))
  }

  /**
   * Lista las connection_ids donde un user es invitado (con shared rows).
   * Usado por `ConnectionsRepository.listByUser` para combinar propias +
   * compartidas.
   */
  async listConnectionIdsForSharedUser(
    userId: string,
  ): Promise<{ connectionId: string; permission: ConnectionPermission }[]> {
    const rows = await this.db
      .select({
        connectionId: connectionAccess.connectionId,
        permission: connectionAccess.permission,
      })
      .from(connectionAccess)
      .where(eq(connectionAccess.userId, userId))
    return rows.map((r) => ({
      connectionId: r.connectionId,
      permission: r.permission as ConnectionPermission,
    }))
  }

  async insert(
    connectionId: string,
    userId: string,
    permission: ConnectionPermission,
  ): Promise<ConnectionAccess> {
    const [row] = await this.db
      .insert(connectionAccess)
      .values({ connectionId, userId, permission })
      .returning()
    if (!row) throw new Error('ConnectionAccessRepository.insert: no row returned')
    return row
  }

  /**
   * Verifica que un user existe (para validar antes de insert y devolver
   * un error amigable en vez de 500 por FK violation).
   */
  async userExists(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return row !== undefined
  }

  async updatePermission(
    connectionId: string,
    userId: string,
    permission: ConnectionPermission,
  ): Promise<ConnectionAccess | null> {
    const [row] = await this.db
      .update(connectionAccess)
      .set({ permission, updatedAt: new Date() })
      .where(
        and(eq(connectionAccess.connectionId, connectionId), eq(connectionAccess.userId, userId)),
      )
      .returning()
    return row ?? null
  }

  async delete(connectionId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(connectionAccess)
      .where(
        and(eq(connectionAccess.connectionId, connectionId), eq(connectionAccess.userId, userId)),
      )
      .returning({ connectionId: connectionAccess.connectionId })
    return result.length > 0
  }
}
