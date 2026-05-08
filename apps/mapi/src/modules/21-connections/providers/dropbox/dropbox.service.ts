import { randomBytes } from 'node:crypto'
import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import type Redis from 'ioredis'
import { AppConfigService } from '../../../../core/config/config.service'
import { REDIS_CLIENT } from '../../../../core/auth/redis.module'
import { EventLogService } from '../../../95-event-log/event-log.service'
import { ConnectionAuthError, ConnectionStateInvalidError } from '../../connection.errors'
import { ConnectionsService } from '../../connections.service'
import { DROPBOX_FETCH } from './dropbox.provider'

const STATE_TTL_SECONDS = 600
const STATE_PREFIX = 'oauth:state:dropbox:'
const DBX_AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize'
const DBX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token'
const DBX_GET_CURRENT_ACCOUNT_URL = 'https://api.dropboxapi.com/2/users/get_current_account'

// Subset de scopes habilitados en developer console; estos son los que cada
// usuario verá en el consent. Read-only por ahora; write se agrega cuando se requiera.
const SCOPES = 'account_info.read files.metadata.read files.content.read sharing.read'

interface OauthStatePayload {
  user_id: string
  label: string | null
  created_at: string
}

interface DropboxTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
  account_id: string
  uid: string
}

interface DropboxAccountResponse {
  account_id: string
  email: string
  email_verified: boolean
}

export interface CallbackResult {
  email: string
  externalAccountId: string
  label: string | null
}

@Injectable()
export class DropboxConnectionService {
  private readonly logger = new Logger(DropboxConnectionService.name)

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly connections: ConnectionsService,
    private readonly cfg: AppConfigService,
    private readonly events: EventLogService,
    @Optional() @Inject(DROPBOX_FETCH) private readonly fetchFn: typeof fetch = fetch,
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
      client_id: this.cfg.dropboxClientId,
      response_type: 'code',
      redirect_uri: this.cfg.dropboxRedirectUri,
      // token_access_type=offline => issues refresh_token + short-lived access_token.
      token_access_type: 'offline',
      scope: SCOPES,
      state,
    })

    return `${DBX_AUTHORIZE_URL}?${params.toString()}`
  }

  async handleCallback(code: string, state: string): Promise<CallbackResult> {
    const stateKey = `${STATE_PREFIX}${state}`
    const rawPayload = await this.redis.get(stateKey)
    if (!rawPayload) throw new ConnectionStateInvalidError()

    const payload = JSON.parse(rawPayload) as OauthStatePayload

    const tokenResponse = await this.exchangeCode(code)
    const me = await this.fetchAccount(tokenResponse.access_token)

    const accessTokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000)

    const connection = await this.connections.upsert({
      userId: payload.user_id,
      provider: 'dropbox',
      externalAccountId: me.account_id,
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
        provider: 'dropbox',
        email: me.email,
        external_account_id: me.account_id,
        label: payload.label,
      },
      payload.user_id,
      { type: 'connection', id: connection.id },
    )

    return { email: me.email, externalAccountId: me.account_id, label: payload.label }
  }

  private async exchangeCode(code: string): Promise<DropboxTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.cfg.dropboxRedirectUri,
      client_id: this.cfg.dropboxClientId,
      client_secret: this.cfg.dropboxClientSecret,
    })

    const res = await this.fetchFn(DBX_TOKEN_URL, {
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
        `Dropbox exchange falló ${res.status}: ${errBody?.error ?? 'unknown'} ${errBody?.error_description ?? ''}`,
      )
      if (errBody?.error === 'invalid_grant') {
        throw new ConnectionStateInvalidError()
      }
      throw new ConnectionAuthError(
        `No se pudo intercambiar code por tokens: ${errBody?.error ?? res.status}`,
      )
    }

    return (await res.json()) as DropboxTokenResponse
  }

  private async fetchAccount(accessToken: string): Promise<DropboxAccountResponse> {
    // get_current_account no recibe argumentos: hay que mandar request SIN body
    // y SIN Content-Type. Si mandas body o Content-Type, Dropbox responde 400.
    const res = await this.fetchFn(DBX_GET_CURRENT_ACCOUNT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new ConnectionAuthError(`Dropbox get_current_account falló: ${res.status} ${errBody}`)
    }
    return (await res.json()) as DropboxAccountResponse
  }
}
