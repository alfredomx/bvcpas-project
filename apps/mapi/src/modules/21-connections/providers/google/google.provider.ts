import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { AppConfigService } from '../../../../core/config/config.service'
import type { DecryptedUserConnection } from '../../../../db/schema/user-connections'
import { ConnectionAuthError, ConnectionRefreshExpiredError } from '../../connection.errors'
import type {
  IProvider,
  ProviderProfile,
  TestResult,
  TokenRefreshResult,
} from '../provider.interface'

export const GOOGLE_FETCH = Symbol('GOOGLE_FETCH')

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

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
  picture?: string
}

@Injectable()
export class GoogleProvider implements IProvider {
  readonly name = 'google' as const
  private readonly logger = new Logger(GoogleProvider.name)

  constructor(
    private readonly cfg: AppConfigService,
    @Optional() @Inject(GOOGLE_FETCH) private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async refresh(connection: DecryptedUserConnection): Promise<TokenRefreshResult> {
    if (connection.refreshToken === null) {
      throw new ConnectionRefreshExpiredError(connection.id)
    }
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
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
      if (errBody?.error === 'invalid_grant') {
        this.logger.warn(`Google refresh invalid_grant`)
        throw new ConnectionRefreshExpiredError('google')
      }
      throw new ConnectionAuthError(
        `Google refresh falló: ${errBody?.error ?? res.status} ${errBody?.error_description ?? ''}`,
      )
    }

    const data = (await res.json()) as GoogleTokenResponse
    return {
      accessToken: data.access_token,
      // Google no rota refresh tokens; mantenemos el actual.
      refreshToken: data.refresh_token ?? connection.refreshToken,
      expiresIn: data.expires_in,
      scopes: data.scope,
    }
  }

  async getProfile(accessToken: string): Promise<ProviderProfile> {
    const res = await this.fetchFn(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new ConnectionAuthError(`Google userinfo falló: ${res.status}`)
    }
    const me = (await res.json()) as GoogleUserInfoResponse
    return {
      externalAccountId: me.sub,
      email: me.email ?? null,
    }
  }

  async test(connection: DecryptedUserConnection): Promise<TestResult> {
    const profile = await this.getProfile(connection.accessToken)
    return {
      ok: true,
      message: `Cuenta Google ${profile.email ?? profile.externalAccountId} accesible`,
    }
  }
}
