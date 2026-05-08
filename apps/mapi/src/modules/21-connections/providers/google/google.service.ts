import { randomBytes } from 'node:crypto'
import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import type Redis from 'ioredis'
import { AppConfigService } from '../../../../core/config/config.service'
import { REDIS_CLIENT } from '../../../../core/auth/redis.module'
import { EventLogService } from '../../../95-event-log/event-log.service'
import { ConnectionAuthError, ConnectionStateInvalidError } from '../../connection.errors'
import { ConnectionsService } from '../../connections.service'
import { GOOGLE_FETCH } from './google.provider'

const STATE_TTL_SECONDS = 600
const STATE_PREFIX = 'oauth:state:google:'
const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

// drive.readonly: leer todos los archivos del Drive del user (incluye los compartidos).
// openid+email+profile: para identificar al user (sub + email).
const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.readonly'

interface OauthStatePayload {
  user_id: string
  label: string | null
  created_at: string
}

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  token_type: string
  id_token?: string
}

interface GoogleUserInfoResponse {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
}

export interface CallbackResult {
  email: string
  externalAccountId: string
  label: string | null
}

@Injectable()
export class GoogleConnectionService {
  private readonly logger = new Logger(GoogleConnectionService.name)

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly connections: ConnectionsService,
    private readonly cfg: AppConfigService,
    private readonly events: EventLogService,
    @Optional() @Inject(GOOGLE_FETCH) private readonly fetchFn: typeof fetch = fetch,
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
      client_id: this.cfg.googleClientId,
      response_type: 'code',
      redirect_uri: this.cfg.googleRedirectUri,
      scope: SCOPES,
      state,
      // access_type=offline + prompt=consent => Google emite refresh_token
      // incluso en re-autorizaciones del mismo user.
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    })

    return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`
  }

  async handleCallback(code: string, state: string): Promise<CallbackResult> {
    const stateKey = `${STATE_PREFIX}${state}`
    const rawPayload = await this.redis.get(stateKey)
    if (!rawPayload) throw new ConnectionStateInvalidError()

    const payload = JSON.parse(rawPayload) as OauthStatePayload

    const tokenResponse = await this.exchangeCode(code)
    const me = await this.fetchUserInfo(tokenResponse.access_token)

    if (!me.email) {
      throw new ConnectionAuthError(
        `Google userinfo no devolvió email para user=${payload.user_id}`,
      )
    }

    const accessTokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000)

    const connection = await this.connections.upsert({
      userId: payload.user_id,
      provider: 'google',
      externalAccountId: me.sub,
      email: me.email,
      label: payload.label,
      scopes: tokenResponse.scope || SCOPES,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? null,
      accessTokenExpiresAt,
    })

    await this.redis.del(stateKey)

    await this.events.log(
      'connection.created',
      {
        provider: 'google',
        email: me.email,
        external_account_id: me.sub,
        label: payload.label,
      },
      payload.user_id,
      { type: 'connection', id: connection.id },
    )

    return { email: me.email, externalAccountId: me.sub, label: payload.label }
  }

  private async exchangeCode(code: string): Promise<GoogleTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.cfg.googleRedirectUri,
      client_id: this.cfg.googleClientId,
      client_secret: this.cfg.googleClientSecret,
    })

    const res = await this.fetchFn(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) {
      const errBody = (await res.json().catch(() => null)) as {
        error?: string
        error_description?: string
      } | null
      this.logger.warn(
        `Google exchange falló ${res.status}: ${errBody?.error ?? 'unknown'} ${errBody?.error_description ?? ''}`,
      )
      if (errBody?.error === 'invalid_grant') {
        throw new ConnectionStateInvalidError()
      }
      throw new ConnectionAuthError(
        `No se pudo intercambiar code por tokens: ${errBody?.error ?? res.status}`,
      )
    }

    return (await res.json()) as GoogleTokenResponse
  }

  private async fetchUserInfo(accessToken: string): Promise<GoogleUserInfoResponse> {
    const res = await this.fetchFn(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new ConnectionAuthError(`Google userinfo falló: ${res.status}`)
    }
    return (await res.json()) as GoogleUserInfoResponse
  }
}
