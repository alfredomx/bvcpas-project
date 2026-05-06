import { randomBytes } from 'node:crypto'
import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import type Redis from 'ioredis'
import { AppConfigService } from '../../../../core/config/config.service'
import { REDIS_CLIENT } from '../../../../core/auth/redis.module'
import { EventLogService } from '../../../95-event-log/event-log.service'
import { ConnectionAuthError, ConnectionStateInvalidError } from '../../connection.errors'
import { ConnectionsService } from '../../connections.service'
import { MSFT_FETCH } from './graph-mail.service'

const STATE_TTL_SECONDS = 600
const STATE_PREFIX = 'oauth:state:msft:'
const MS_AUTHORIZE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const GRAPH_ME_URL = 'https://graph.microsoft.com/v1.0/me'
const SCOPES = 'Mail.Send User.Read offline_access'

interface OauthStatePayload {
  user_id: string
  label: string | null
  created_at: string
}

interface MicrosoftTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
  token_type: string
}

interface GraphMeResponse {
  id: string
  mail?: string | null
  userPrincipalName?: string | null
  displayName?: string | null
}

export interface CallbackResult {
  email: string
  externalAccountId: string
  label: string | null
}

/**
 * Orquesta el flow OAuth de Microsoft para crear/actualizar conexiones
 * en `user_connections`. La lógica genérica (cifrado, persistencia)
 * vive en `ConnectionsService.upsert`.
 */
@Injectable()
export class MicrosoftConnectionService {
  private readonly logger = new Logger(MicrosoftConnectionService.name)

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly connections: ConnectionsService,
    private readonly cfg: AppConfigService,
    private readonly events: EventLogService,
    @Optional() @Inject(MSFT_FETCH) private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async buildAuthorizationUrl(userId: string, label?: string): Promise<string> {
    const state = randomBytes(24).toString('hex')
    const payload: OauthStatePayload = {
      user_id: userId,
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
      client_id: this.cfg.microsoftClientId,
      response_type: 'code',
      redirect_uri: this.cfg.microsoftRedirectUri,
      response_mode: 'query',
      scope: SCOPES,
      state,
      prompt: 'consent',
    })

    return `${MS_AUTHORIZE_URL}?${params.toString()}`
  }

  async handleCallback(code: string, state: string): Promise<CallbackResult> {
    const stateKey = `${STATE_PREFIX}${state}`
    const rawPayload = await this.redis.get(stateKey)
    if (!rawPayload) throw new ConnectionStateInvalidError()

    const payload = JSON.parse(rawPayload) as OauthStatePayload

    const tokenResponse = await this.exchangeCode(code)
    const me = await this.fetchGraphMe(tokenResponse.access_token)

    const email = me.mail ?? me.userPrincipalName ?? null
    if (!email) {
      throw new ConnectionAuthError(`Graph /me no devolvió email para user=${payload.user_id}`)
    }

    const accessTokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000)

    const connection = await this.connections.upsert({
      userId: payload.user_id,
      provider: 'microsoft',
      externalAccountId: me.id,
      email,
      label: payload.label,
      scopes: tokenResponse.scope || SCOPES,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      accessTokenExpiresAt,
    })

    await this.redis.del(stateKey)

    await this.events.log(
      'connection.created',
      { provider: 'microsoft', email, external_account_id: me.id, label: payload.label },
      payload.user_id,
      { type: 'connection', id: connection.id },
    )

    return { email, externalAccountId: me.id, label: payload.label }
  }

  private async exchangeCode(code: string): Promise<MicrosoftTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.cfg.microsoftRedirectUri,
      client_id: this.cfg.microsoftClientId,
      client_secret: this.cfg.microsoftClientSecret,
    })

    const res = await this.fetchFn(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) {
      const errBody = (await res.json().catch(() => null)) as {
        error: string
        error_description?: string
      } | null
      const desc = errBody?.error_description ?? ''
      this.logger.warn(
        `Microsoft exchange falló ${res.status}: ${errBody?.error ?? 'unknown'} ${desc}`,
      )

      // Caso típico: el usuario recargó la pestaña del callback o el browser
      // hizo pre-fetch, y Microsoft dice "code already redeemed". Es problema
      // del cliente, no del provider — devolvemos un 400 informativo en vez
      // de 502 (que sugeriría que Microsoft está caído).
      if (errBody?.error === 'invalid_grant' && desc.includes('AADSTS54005')) {
        throw new ConnectionStateInvalidError()
      }

      throw new ConnectionAuthError(
        `No se pudo intercambiar code por tokens: ${errBody?.error ?? res.status}`,
      )
    }

    return (await res.json()) as MicrosoftTokenResponse
  }

  private async fetchGraphMe(accessToken: string): Promise<GraphMeResponse> {
    const res = await this.fetchFn(GRAPH_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new ConnectionAuthError(`Graph /me falló con status ${res.status}`)
    }
    return (await res.json()) as GraphMeResponse
  }
}
