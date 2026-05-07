import { Injectable } from '@nestjs/common'
import { EncryptionService } from '../../core/encryption/encryption.service'
import type {
  DecryptedUserConnection,
  Provider,
  ScopeType,
  UserConnection,
} from '../../db/schema/user-connections'
import { ConnectionNotFoundError, IntuitPersonalConnectionRequiredError } from './connection.errors'
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
 */
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
  createdAt: Date
  updatedAt: Date
}

function toPublic(row: UserConnection): PublicConnection {
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

  async getDecryptedByIdForUser(
    connectionId: string,
    userId: string,
  ): Promise<DecryptedUserConnection> {
    const row = await this.repo.findByIdForUser(connectionId, userId)
    if (!row) throw new ConnectionNotFoundError(connectionId)
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

  async listByUser(userId: string, filters: ListByUserFilters = {}): Promise<PublicConnection[]> {
    const rows = await this.repo.listByUser(userId, filters)
    return rows.map(toPublic)
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
}
