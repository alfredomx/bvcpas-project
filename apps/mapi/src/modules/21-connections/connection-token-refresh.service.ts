import { Injectable } from '@nestjs/common'
import type { DecryptedUserConnection, Provider } from '../../db/schema/user-connections'
import type { TokenRefreshResult } from './providers/provider.interface'
import { IntuitTokensNotFoundError } from '../20-intuit-oauth/intuit-oauth.errors'
import { ConnectionsService } from './connections.service'
import { ProviderRegistry } from './provider-registry.service'

const REFRESH_BUFFER_MS = 5 * 60 * 1000 // 5 min

/**
 * Devuelve un access_token vigente para llamar a la API del provider.
 * Refresca on-demand si el token actual expira en <5 min, delegando la
 * llamada HTTP al provider correspondiente vía `IProvider.refresh()`.
 *
 * Genérico: no sabe nada de Microsoft/Intuit/etc. específicamente.
 * Cada provider recibe la connection completa (no solo refreshToken)
 * porque algunos (Intuit) necesitan más contexto.
 */
@Injectable()
export class ConnectionTokenRefreshService {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly registry: ProviderRegistry,
  ) {}

  /**
   * Para una conexión específica del user. Usado por providers por-user
   * (Microsoft) donde el connectionId se conoce de antemano.
   */
  async getValidAccessToken(connectionId: string, userId: string): Promise<string> {
    const decrypted = await this.connections.getDecryptedByIdForUser(connectionId, userId)
    return this.refreshIfNeeded(decrypted)
  }

  /**
   * Para un cliente (Intuit), modo LECTURA. Prefiere personal del user;
   * fallback a global readonly. Si ninguna existe, lanza
   * IntuitTokensNotFoundError (HTTP 404).
   */
  async getValidAccessTokenForClientRead(
    provider: Provider,
    clientId: string,
    userId: string,
  ): Promise<string> {
    const decrypted = await this.connections.findActiveForRead(provider, clientId, userId)
    if (!decrypted) throw new IntuitTokensNotFoundError(clientId)
    return this.refreshIfNeeded(decrypted)
  }

  /**
   * Para un cliente (Intuit), modo ESCRITURA. SOLO personal del user con
   * scope_type='full'. Si no existe, ConnectionsService lanza
   * IntuitPersonalConnectionRequiredError (HTTP 403).
   */
  async getValidAccessTokenForClientWrite(
    provider: Provider,
    clientId: string,
    userId: string,
  ): Promise<string> {
    const decrypted = await this.connections.findActiveForWriteOrThrow(provider, clientId, userId)
    return this.refreshIfNeeded(decrypted)
  }

  private async refreshIfNeeded(decrypted: DecryptedUserConnection): Promise<string> {
    const msUntilExpiry = decrypted.accessTokenExpiresAt.getTime() - Date.now()
    if (msUntilExpiry > REFRESH_BUFFER_MS) {
      return decrypted.accessToken
    }
    const provider = this.registry.get(decrypted.provider)
    const refreshed = await provider.refresh(decrypted)
    await this.persistRefreshed(decrypted, refreshed)
    return refreshed.accessToken
  }

  private async persistRefreshed(
    decrypted: DecryptedUserConnection,
    refreshed: TokenRefreshResult,
  ): Promise<void> {
    const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000)
    const newRefreshExpiresAt =
      refreshed.refreshTokenExpiresIn !== undefined
        ? new Date(Date.now() + refreshed.refreshTokenExpiresIn * 1000)
        : null
    await this.connections.upsert({
      userId: decrypted.userId,
      provider: decrypted.provider,
      externalAccountId: decrypted.externalAccountId,
      clientId: decrypted.clientId,
      scopeType: decrypted.scopeType,
      email: decrypted.email,
      label: decrypted.label,
      scopes: refreshed.scopes,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      accessTokenExpiresAt: newExpiresAt,
      refreshTokenExpiresAt: newRefreshExpiresAt,
    })
  }
}
