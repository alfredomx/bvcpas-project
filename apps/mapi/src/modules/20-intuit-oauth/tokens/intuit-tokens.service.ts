import { Injectable } from '@nestjs/common'
import { EncryptionService } from '../../../core/encryption/encryption.service'
import { MetricsService } from '../../../core/metrics/metrics.service'
import type { DecryptedIntuitToken, IntuitToken } from '../../../db/schema/intuit-tokens'
import { EventLogService } from '../../95-event-log/event-log.service'
import { IntuitOauthClientFactory } from '../intuit-oauth-client.factory'
import { IntuitRefreshTokenExpiredError, IntuitTokensNotFoundError } from '../intuit-oauth.errors'
import { IntuitTokensRepository } from './intuit-tokens.repository'

const REFRESH_BUFFER_MS = 60 * 1000

interface IntuitRefreshResponse {
  token: {
    access_token: string
    refresh_token: string
    expires_in: number
    x_refresh_token_expires_in: number
  }
}

/**
 * Get/refresh transparente de tokens Intuit por cliente.
 *
 * `getValidTokens` devuelve tokens descifrados, refrescando si access_token
 * expira en <60s. Si el refresh_token también expiró (o Intuit responde
 * `invalid_grant`), lanza `IntuitRefreshTokenExpiredError` (HTTP 401) para
 * que el caller dispare re-autorización del cliente.
 *
 * Sin distributed lock: si en el futuro hay workers paralelos al mismo
 * cliente, agregar Redis SETNX antes del paso refresh (ver BACKLOG).
 */
@Injectable()
export class IntuitTokensService {
  constructor(
    private readonly repo: IntuitTokensRepository,
    private readonly encryption: EncryptionService,
    private readonly oauthClientFactory: IntuitOauthClientFactory,
    private readonly metrics: MetricsService,
    private readonly events: EventLogService,
  ) {}

  async getValidTokens(clientId: string): Promise<DecryptedIntuitToken> {
    const stored = await this.repo.findByClientId(clientId)
    if (!stored) throw new IntuitTokensNotFoundError(clientId)

    const now = Date.now()
    if (stored.refreshTokenExpiresAt.getTime() < now) {
      throw new IntuitRefreshTokenExpiredError(clientId)
    }

    if (stored.accessTokenExpiresAt.getTime() - now > REFRESH_BUFFER_MS) {
      return this.decrypt(stored)
    }

    return this.refresh(clientId, stored)
  }

  /**
   * Forzar refresh aunque access_token siga vigente. Útil cuando el proxy
   * V3 recibe 401 (token revocado server-side antes de expirar).
   */
  async forceRefresh(clientId: string): Promise<DecryptedIntuitToken> {
    const stored = await this.repo.findByClientId(clientId)
    if (!stored) throw new IntuitTokensNotFoundError(clientId)
    if (stored.refreshTokenExpiresAt.getTime() < Date.now()) {
      throw new IntuitRefreshTokenExpiredError(clientId)
    }
    return this.refresh(clientId, stored)
  }

  async deleteTokens(clientId: string, actorUserId: string | null): Promise<void> {
    await this.repo.deleteByClientId(clientId)
    await this.events.log(
      'intuit.tokens.deleted',
      { client_id: clientId },
      actorUserId ?? undefined,
      { type: 'client', id: clientId },
    )
  }

  private async refresh(clientId: string, stored: IntuitToken): Promise<DecryptedIntuitToken> {
    const decrypted: DecryptedIntuitToken = this.decrypt(stored)

    const oauthClient = this.oauthClientFactory.create()
    this.oauthClientFactory.applyToken(oauthClient, decrypted)

    let response: IntuitRefreshResponse
    try {
      response = await oauthClient.refresh()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message.toLowerCase() : ''
      const isExpired =
        errMsg.includes('invalid_grant') || errMsg.includes('refresh token is invalid')
      this.metrics.intuitTokensRefreshTotal.inc({
        client_id: clientId,
        result: isExpired ? 'expired' : 'failed',
      })
      await this.events.log(
        'intuit.tokens.refresh_failed',
        { client_id: clientId, realm_id: stored.realmId, reason: errMsg.slice(0, 200) },
        undefined,
        { type: 'client', id: clientId },
      )
      if (isExpired) {
        throw new IntuitRefreshTokenExpiredError(clientId)
      }
      throw err
    }

    const { access_token, refresh_token, expires_in, x_refresh_token_expires_in } = response.token

    const now = new Date()
    const accessTokenExpiresAt = new Date(now.getTime() + expires_in * 1000)
    const refreshTokenExpiresAt = new Date(now.getTime() + x_refresh_token_expires_in * 1000)

    await this.repo.updateRefreshed(clientId, {
      accessTokenEncrypted: this.encryption.encrypt(access_token),
      refreshTokenEncrypted: this.encryption.encrypt(refresh_token),
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    })

    this.metrics.intuitTokensRefreshTotal.inc({ client_id: clientId, result: 'success' })

    await this.events.log(
      'intuit.tokens.refreshed',
      { client_id: clientId, realm_id: stored.realmId },
      undefined,
      { type: 'client', id: clientId },
    )

    return {
      clientId,
      realmId: stored.realmId,
      accessToken: access_token,
      refreshToken: refresh_token,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    }
  }

  private decrypt(stored: IntuitToken): DecryptedIntuitToken {
    return {
      clientId: stored.clientId,
      realmId: stored.realmId,
      accessToken: this.encryption.decrypt(stored.accessTokenEncrypted),
      refreshToken: this.encryption.decrypt(stored.refreshTokenEncrypted),
      accessTokenExpiresAt: stored.accessTokenExpiresAt,
      refreshTokenExpiresAt: stored.refreshTokenExpiresAt,
    }
  }
}
