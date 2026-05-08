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

export const DROPBOX_FETCH = Symbol('DROPBOX_FETCH')

const DBX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token'
const DBX_GET_CURRENT_ACCOUNT_URL = 'https://api.dropboxapi.com/2/users/get_current_account'

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
  name: { display_name?: string }
  email: string
  email_verified: boolean
}

@Injectable()
export class DropboxProvider implements IProvider {
  readonly name = 'dropbox' as const
  private readonly logger = new Logger(DropboxProvider.name)

  constructor(
    private readonly cfg: AppConfigService,
    @Optional() @Inject(DROPBOX_FETCH) private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async refresh(connection: DecryptedUserConnection): Promise<TokenRefreshResult> {
    if (connection.refreshToken === null) {
      throw new ConnectionRefreshExpiredError(connection.id)
    }
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
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
      if (errBody?.error === 'invalid_grant') {
        this.logger.warn(`Dropbox refresh invalid_grant`)
        throw new ConnectionRefreshExpiredError('dropbox')
      }
      throw new ConnectionAuthError(
        `Dropbox refresh falló: ${errBody?.error ?? res.status} ${errBody?.error_description ?? ''}`,
      )
    }

    const data = (await res.json()) as DropboxTokenResponse
    return {
      accessToken: data.access_token,
      // Dropbox no rota refresh tokens en cada refresh; mantenemos el actual.
      refreshToken: data.refresh_token ?? connection.refreshToken,
      expiresIn: data.expires_in,
      scopes: data.scope,
    }
  }

  async getProfile(accessToken: string): Promise<ProviderProfile> {
    // get_current_account: POST sin body y sin Content-Type. Cualquier body
    // (incluso 'null' literal) hace que Dropbox responda 400.
    const res = await this.fetchFn(DBX_GET_CURRENT_ACCOUNT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      throw new ConnectionAuthError(`Dropbox /users/get_current_account falló: ${res.status}`)
    }
    const me = (await res.json()) as DropboxAccountResponse
    return {
      externalAccountId: me.account_id,
      email: me.email ?? null,
    }
  }

  async test(connection: DecryptedUserConnection): Promise<TestResult> {
    // El "test" para Dropbox es pedir el profile; prueba que el token+scopes funcionan.
    const profile = await this.getProfile(connection.accessToken)
    return {
      ok: true,
      message: `Cuenta Dropbox ${profile.email ?? profile.externalAccountId} accesible`,
    }
  }
}
