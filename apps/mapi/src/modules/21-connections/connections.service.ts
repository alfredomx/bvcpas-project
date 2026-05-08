import { Injectable } from '@nestjs/common'
import { EncryptionService } from '../../core/encryption/encryption.service'
import type { ConnectionPermission } from '../../db/schema/connection-access'
import type {
  DecryptedUserConnection,
  Provider,
  ScopeType,
  UserConnection,
} from '../../db/schema/user-connections'
import { ConnectionAccessRepository, type ShareWithUser } from './connection-access.repository'
import {
  ConnectionNotFoundError,
  ConnectionNotOwnerError,
  ConnectionShareDuplicateError,
  ConnectionShareNotFoundError,
  ConnectionShareSelfError,
  ConnectionShareTargetUserNotFoundError,
  IntuitPersonalConnectionRequiredError,
} from './connection.errors'
import { ConnectionsRepository, type ListByUserFilters } from './connections.repository'

export interface UpsertPlainConnection {
  userId: string
  provider: Provider
  externalAccountId: string
  clientId?: string | null
  scopeType?: ScopeType
  email: string | null
  label: string | null
  scopes: string
  accessToken: string
  refreshToken: string | null
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt?: Date | null
  metadata?: Record<string, unknown> | null
}

/**
 * Vista pública de una conexión (sin tokens cifrados ni metadata
 * interna). Es lo que se devuelve al frontend en GET /v1/connections.
 *
 * `accessRole` (v0.10.0): rol del user actual sobre la conexión.
 *   - 'owner'        → la creó él (`user_connections.user_id = userId`).
 *   - 'shared-write' → invitado con permission='write' en connection_access.
 *   - 'shared-read'  → invitado con permission='read'.
 *
 * Es derivado por user que consulta — la misma row puede ser 'owner' para
 * Pepe y 'shared-write' para María. NO se persiste.
 */
export type ConnectionAccessRole = 'owner' | 'shared-read' | 'shared-write'

export interface PublicConnection {
  id: string
  userId: string
  provider: Provider
  externalAccountId: string
  clientId: string | null
  scopeType: ScopeType
  email: string | null
  label: string | null
  scopes: string
  accessTokenExpiresAt: Date
  accessRole: ConnectionAccessRole
  createdAt: Date
  updatedAt: Date
}

function toPublic(
  row: UserConnection,
  accessRole: ConnectionAccessRole = 'owner',
): PublicConnection {
  return {
    accessRole,
    id: row.id,
    userId: row.userId,
    provider: row.provider as Provider,
    externalAccountId: row.externalAccountId,
    clientId: row.clientId,
    scopeType: row.scopeType as ScopeType,
    email: row.email,
    label: row.label,
    scopes: row.scopes,
    accessTokenExpiresAt: row.accessTokenExpiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toDecrypted(row: UserConnection, encryption: EncryptionService): DecryptedUserConnection {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider as Provider,
    externalAccountId: row.externalAccountId,
    clientId: row.clientId,
    scopeType: row.scopeType as ScopeType,
    email: row.email,
    label: row.label,
    scopes: row.scopes,
    accessToken: encryption.decrypt(row.accessTokenEncrypted),
    refreshToken:
      row.refreshTokenEncrypted === null ? null : encryption.decrypt(row.refreshTokenEncrypted),
    accessTokenExpiresAt: row.accessTokenExpiresAt,
    refreshTokenExpiresAt: row.refreshTokenExpiresAt,
  }
}

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly repo: ConnectionsRepository,
    private readonly accessRepo: ConnectionAccessRepository,
    private readonly encryption: EncryptionService,
  ) {}

  async upsert(data: UpsertPlainConnection): Promise<PublicConnection> {
    const row = await this.repo.upsert({
      userId: data.userId,
      provider: data.provider,
      externalAccountId: data.externalAccountId,
      clientId: data.clientId,
      scopeType: data.scopeType,
      email: data.email,
      label: data.label,
      scopes: data.scopes,
      accessTokenEncrypted: this.encryption.encrypt(data.accessToken),
      refreshTokenEncrypted:
        data.refreshToken === null ? null : this.encryption.encrypt(data.refreshToken),
      accessTokenExpiresAt: data.accessTokenExpiresAt,
      refreshTokenExpiresAt: data.refreshTokenExpiresAt,
      metadata: data.metadata ?? null,
    })
    return toPublic(row)
  }

  /**
   * v0.10.0 — Devuelve la conexión descifrada si el user tiene acceso
   * (dueño O shared con cualquier permission). Para acciones que sí
   * requieren escritura, usar `getDecryptedForWriteByIdForUser`.
   *
   * Throws ConnectionNotFoundError si no existe o el user no tiene acceso.
   */
  async getDecryptedByIdForUser(
    connectionId: string,
    userId: string,
  ): Promise<DecryptedUserConnection> {
    const row = await this.repo.findById(connectionId)
    if (!row) throw new ConnectionNotFoundError(connectionId)

    if (row.userId !== userId) {
      // No es dueño — verificar que tenga share row (cualquier permission).
      const share = await this.accessRepo.findByConnectionAndUser(connectionId, userId)
      if (!share) throw new ConnectionNotFoundError(connectionId)
    }

    return toDecrypted(row, this.encryption)
  }

  /**
   * v0.10.0 — Solo permite acceso si el user es dueño O shared con
   * permission='write'. Lanza ConnectionNotFoundError si no.
   */
  async getDecryptedForWriteByIdForUser(
    connectionId: string,
    userId: string,
  ): Promise<DecryptedUserConnection> {
    const row = await this.repo.findById(connectionId)
    if (!row) throw new ConnectionNotFoundError(connectionId)

    if (row.userId !== userId) {
      const share = await this.accessRepo.findByConnectionAndUser(connectionId, userId)
      if (share?.permission !== 'write') {
        throw new ConnectionNotFoundError(connectionId)
      }
    }

    return toDecrypted(row, this.encryption)
  }

  /**
   * Conexión activa para LECTURA sobre un cliente.
   * Política (delegada al repository):
   * 1. Personal del user con scope_type='full'.
   * 2. Fallback a global readonly.
   * Devuelve null si ninguna existe.
   */
  async findActiveForRead(
    provider: Provider,
    clientId: string,
    userId: string,
  ): Promise<DecryptedUserConnection | null> {
    const row = await this.repo.findActiveForRead(provider, clientId, userId)
    if (!row) return null
    return toDecrypted(row, this.encryption)
  }

  /**
   * Conexión activa para ESCRITURA sobre un cliente.
   * Política: SOLO personal del user con scope_type='full'.
   * Si no existe → IntuitPersonalConnectionRequiredError (HTTP 403)
   * para Intuit. Para otros providers se podría generalizar.
   */
  async findActiveForWriteOrThrow(
    provider: Provider,
    clientId: string,
    userId: string,
  ): Promise<DecryptedUserConnection> {
    const row = await this.repo.findActiveForWrite(provider, clientId, userId)
    if (!row) throw new IntuitPersonalConnectionRequiredError(clientId)
    return toDecrypted(row, this.encryption)
  }

  /**
   * v0.10.0 — Lista TODAS las conexiones visibles para el user:
   * propias + compartidas con él. Cada item lleva su `accessRole`.
   */
  async listByUser(userId: string, filters: ListByUserFilters = {}): Promise<PublicConnection[]> {
    const rows = await this.repo.listVisibleByUser(userId, filters)
    if (rows.length === 0) return []

    // Resolver roles para las que NO son del user actual.
    const sharedRows = rows.filter((r) => r.userId !== userId)
    let permissionsByConn = new Map<string, ConnectionPermission>()
    if (sharedRows.length > 0) {
      const accessRows = await this.accessRepo.listConnectionIdsForSharedUser(userId)
      permissionsByConn = new Map(accessRows.map((r) => [r.connectionId, r.permission]))
    }

    return rows.map((row) => {
      if (row.userId === userId) return toPublic(row, 'owner')
      const perm = permissionsByConn.get(row.id)
      const role: ConnectionAccessRole = perm === 'write' ? 'shared-write' : 'shared-read'
      return toPublic(row, role)
    })
  }

  async deleteByIdForUser(connectionId: string, userId: string): Promise<void> {
    const deleted = await this.repo.deleteByIdForUser(connectionId, userId)
    if (!deleted) throw new ConnectionNotFoundError(connectionId)
  }

  async updateLabelForUser(
    connectionId: string,
    userId: string,
    label: string | null,
  ): Promise<PublicConnection> {
    const row = await this.repo.updateLabelForUser(connectionId, userId, label)
    if (!row) throw new ConnectionNotFoundError(connectionId)
    return toPublic(row)
  }

  // ─────────────────────────────────────────────────────────────────
  // v0.10.0 — Sharing
  // ─────────────────────────────────────────────────────────────────

  /**
   * Verifica que el user es DUEÑO de la conexión.
   * Lanza ConnectionNotFoundError si no existe; ConnectionNotOwnerError
   * si existe pero no es del user.
   */
  private async assertOwner(connectionId: string, userId: string): Promise<UserConnection> {
    const row = await this.repo.findById(connectionId)
    if (!row) throw new ConnectionNotFoundError(connectionId)
    if (row.userId !== userId) throw new ConnectionNotOwnerError(connectionId)
    return row
  }

  /**
   * Comparte una conexión con un user. Solo el dueño puede llamarlo.
   */
  async share(
    connectionId: string,
    actorUserId: string,
    targetUserId: string,
    permission: ConnectionPermission,
  ): Promise<ShareWithUser> {
    await this.assertOwner(connectionId, actorUserId)
    if (targetUserId === actorUserId) throw new ConnectionShareSelfError()

    const targetExists = await this.accessRepo.userExists(targetUserId)
    if (!targetExists) throw new ConnectionShareTargetUserNotFoundError(targetUserId)

    const existing = await this.accessRepo.findByConnectionAndUser(connectionId, targetUserId)
    if (existing) throw new ConnectionShareDuplicateError(connectionId, targetUserId)

    await this.accessRepo.insert(connectionId, targetUserId, permission)

    // Re-leer con join a users para devolver info completa.
    const all = await this.accessRepo.listByConnection(connectionId)
    const created = all.find((s) => s.userId === targetUserId)
    if (!created) throw new Error('Share insertado pero no encontrado al releer')
    return created
  }

  /**
   * Cambia permission de un share existente. Solo dueño.
   */
  async updateSharePermission(
    connectionId: string,
    actorUserId: string,
    targetUserId: string,
    permission: ConnectionPermission,
  ): Promise<ShareWithUser> {
    await this.assertOwner(connectionId, actorUserId)
    const updated = await this.accessRepo.updatePermission(connectionId, targetUserId, permission)
    if (!updated) throw new ConnectionShareNotFoundError(connectionId, targetUserId)

    const all = await this.accessRepo.listByConnection(connectionId)
    const row = all.find((s) => s.userId === targetUserId)
    if (!row) throw new Error('Share actualizado pero no encontrado al releer')
    return row
  }

  /**
   * Borra un share. Solo dueño.
   */
  async revokeShare(
    connectionId: string,
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.assertOwner(connectionId, actorUserId)
    const deleted = await this.accessRepo.delete(connectionId, targetUserId)
    if (!deleted) throw new ConnectionShareNotFoundError(connectionId, targetUserId)
  }

  /**
   * Lista los shares de una conexión. Solo dueño.
   */
  async listShares(connectionId: string, actorUserId: string): Promise<ShareWithUser[]> {
    await this.assertOwner(connectionId, actorUserId)
    return this.accessRepo.listByConnection(connectionId)
  }
}
