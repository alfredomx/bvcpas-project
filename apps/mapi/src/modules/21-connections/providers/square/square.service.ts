import { randomBytes } from 'node:crypto'
import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import type Redis from 'ioredis'
import { AppConfigService } from '../../../../core/config/config.service'
import { REDIS_CLIENT } from '../../../../core/auth/redis.module'
import { EventLogService } from '../../../95-event-log/event-log.service'
import { ConnectionAuthError, ConnectionStateInvalidError } from '../../connection.errors'
import { ConnectionsService } from '../../connections.service'
import { SQUARE_FETCH } from './square.provider'

const STATE_TTL_SECONDS = 600
const STATE_PREFIX = 'oauth:state:square:'
const SQUARE_AUTHORIZE_URL = 'https://connect.squareup.com/oauth2/authorize'
const SQUARE_TOKEN_URL = 'https://connect.squareup.com/oauth2/token'

// Read-only scopes para reportes.
// Ver: https://developer.squareup.com/docs/oauth-api/square-permissions
const SCOPES = 'MERCHANT_PROFILE_READ ORDERS_READ PAYMENTS_READ CUSTOMERS_READ ITEMS_READ'

interface OauthStatePayload {
  user_id: string
  client_id: string // clients.id de BV CPAs
  label: string | null
  created_at: string
}

interface SquareTokenResponse {
  access_token: string
  token_type: string
  expires_at: string
  merchant_id: string
  refresh_token: string
}

export interface CallbackResult {
  merchantId: string
  email: string | null
  label: string | null
  bvcpasClientId: string
}

/**
 * Orquesta el flow OAuth de Square. OAuth-2 estándar (RFC 6749):
 *
 * - Authorize URL: `https://connect.squareup.com/oauth2/authorize`
 * - Token exchange: POST `https://connect.squareup.com/oauth2/token` con
 *   JSON body `{client_id, client_secret, code, grant_type:'authorization_code'}`.
 * - Response incluye `merchant_id` directamente, no hay que pedirlo aparte.
 * - access_token expira en 30 días, refresh_token en 90.
 *
 * Ver: https://developer.squareup.com/docs/oauth-api/overview
 */
@Injectable()
export class SquareConnectionService {
  private readonly logger = new Logger(SquareConnectionService.name)

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly connections: ConnectionsService,
    private readonly cfg: AppConfigService,
    private readonly events: EventLogService,
    @Optional() @Inject(SQUARE_FETCH) private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async buildAuthorizationUrl(
    userId: string,
    bvcpasClientId: string,
    label?: string,
  ): Promise<string> {
    const state = randomBytes(24).toString('hex')
    const payload: OauthStatePayload = {
      user_id: userId,
      client_id: bvcpasClientId,
      label: label ?? null,
      created_at: new Date().toISOString(),
    }

    await this.redis.set(
      `${STATE_PREFIX}${state}`,
      JSON.stringify(payload),
      'EX',
      STATE_TTL_SECONDS,
    )

    const params = new URLSearchParams({
      client_id: this.cfg.squareClientId,
      redirect_uri: this.cfg.squareRedirectUri,
      scope: SCOPES,
      session: 'false',
      state,
    })

    return `${SQUARE_AUTHORIZE_URL}?${params.toString()}`
  }

  async handleCallback(code: string, state: string): Promise<CallbackResult> {
    const stateKey = `${STATE_PREFIX}${state}`
    const rawPayload = await this.redis.get(stateKey)
    if (!rawPayload) throw new ConnectionStateInvalidError()
    const payload = JSON.parse(rawPayload) as OauthStatePayload

    const tokens = await this.exchangeCode(code)

    const accessTokenExpiresAt = new Date(tokens.expires_at)
    // Square no expone refresh_token_expires_at en code flow; asumimos 90 días.
    const refreshTokenExpiresAt = new Date(Date.now() + 90 * 24 * 3600 * 1000)

    const connection = await this.connections.upsert({
      userId: payload.user_id,
      provider: 'square',
      externalAccountId: tokens.merchant_id,
      clientId: payload.client_id,
      scopeType: 'full',
      email: null,
      label: payload.label,
      scopes: SCOPES,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    })

    await this.redis.del(stateKey)

    await this.events.log(
      'connection.created',
      {
        provider: 'square',
        merchant_id: tokens.merchant_id,
        client_id: payload.client_id,
        label: payload.label,
      },
      payload.user_id,
      { type: 'connection', id: connection.id },
    )

    return {
      merchantId: tokens.merchant_id,
      email: null,
      label: payload.label,
      bvcpasClientId: payload.client_id,
    }
  }

  private async exchangeCode(code: string): Promise<SquareTokenResponse> {
    const res = await this.fetchFn(SQUARE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: this.cfg.squareClientId,
        client_secret: this.cfg.squareClientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.cfg.squareRedirectUri,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      this.logger.warn(`Square exchange falló ${res.status}: ${body}`)
      throw new ConnectionAuthError(`Square code exchange falló (${res.status}): ${body}`)
    }

    const data = (await res.json()) as Partial<SquareTokenResponse>
    if (!data.access_token || !data.refresh_token || !data.expires_at || !data.merchant_id) {
      throw new ConnectionAuthError(
        `Square exchange devolvió respuesta incompleta: ${JSON.stringify(data)}`,
      )
    }
    return data as SquareTokenResponse
  }
}
