import { Inject, Injectable } from '@nestjs/common'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../core/db/db.module'
import {
  type Provider,
  type ScopeType,
  type UserConnection,
  userConnections,
} from '../../db/schema/user-connections'

export interface UpsertConnectionData {
  userId: string
  provider: Provider
  externalAccountId: string
  clientId?: string | null
  scopeType?: ScopeType
  email: string | null
  label: string | null
  scopes: string
  accessTokenEncrypted: string
  refreshTokenEncrypted: string | null
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt?: Date | null
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

  /**
   * Conexión activa para LECTURA sobre un cliente. Política:
   * 1. Personal del user actual con scope_type='full' (si existe).
   * 2. Fallback a cualquier conexión 'readonly' del cliente (cuenta global).
   *
   * Devuelve null si ninguna existe — el caller decide si fallar o
   * mostrar UI "conecta tu Intuit".
   *
   * Nota: la query devuelve UN row con priorización via ORDER BY:
   *   - scope_type='full' del user actual primero.
   *   - scope_type='readonly' (cualquier user) después.
   */
  async findActiveForRead(
    provider: Provider,
    clientId: string,
    userId: string,
  ): Promise<UserConnection | null> {
    const [row] = await this.db
      .select()
      .from(userConnections)
      .where(and(eq(userConnections.provider, provider), eq(userConnections.clientId, clientId)))
      // Priorización: la propia del user con scope 'full' gana; readonly cae después.
      .orderBy(
        // Personal del user actual primero
        sql`CASE WHEN ${userConnections.userId} = ${userId} AND ${userConnections.scopeType} = 'full' THEN 0
                 WHEN ${userConnections.scopeType} = 'readonly' THEN 1
                 ELSE 2
            END`,
        // Si hay varias readonly globales, la más recientemente refrescada
        desc(userConnections.lastRefreshedAt),
        asc(userConnections.createdAt),
      )
      .limit(1)
    return row ?? null
  }

  /**
   * Conexión activa para ESCRITURA sobre un cliente. Política:
   * SOLO la personal del user actual con scope_type='full'.
   * Si no existe, devuelve null y el caller lanza
   * `IntuitPersonalConnectionRequiredError`.
   */
  async findActiveForWrite(
    provider: Provider,
    clientId: string,
    userId: string,
  ): Promise<UserConnection | null> {
    const [row] = await this.db
      .select()
      .from(userConnections)
      .where(
        and(
          eq(userConnections.provider, provider),
          eq(userConnections.clientId, clientId),
          eq(userConnections.userId, userId),
          eq(userConnections.scopeType, 'full'),
        ),
      )
      .limit(1)
    return row ?? null
  }

  async upsert(data: UpsertConnectionData): Promise<UserConnection> {
    const [row] = await this.db
      .insert(userConnections)
      .values({
        userId: data.userId,
        provider: data.provider,
        externalAccountId: data.externalAccountId,
        clientId: data.clientId ?? null,
        scopeType: data.scopeType ?? 'full',
        email: data.email,
        label: data.label,
        scopes: data.scopes,
        accessTokenEncrypted: data.accessTokenEncrypted,
        refreshTokenEncrypted: data.refreshTokenEncrypted,
        accessTokenExpiresAt: data.accessTokenExpiresAt,
        refreshTokenExpiresAt: data.refreshTokenExpiresAt ?? null,
        metadata: data.metadata ?? null,
      })
      .onConflictDoUpdate({
        target: [
          userConnections.userId,
          userConnections.provider,
          userConnections.externalAccountId,
        ],
        set: {
          // clientId y scopeType NO se pisan en UPSERT — se preserva el valor existente
          // si no se especifica. Eso evita degradar accidentalmente una connection
          // 'readonly' a 'full' o cambiar el cliente asociado.
          ...(data.clientId !== undefined && { clientId: data.clientId }),
          ...(data.scopeType !== undefined && { scopeType: data.scopeType }),
          email: data.email,
          label: data.label,
          scopes: data.scopes,
          accessTokenEncrypted: data.accessTokenEncrypted,
          refreshTokenEncrypted: data.refreshTokenEncrypted,
          accessTokenExpiresAt: data.accessTokenExpiresAt,
          refreshTokenExpiresAt: data.refreshTokenExpiresAt ?? null,
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
