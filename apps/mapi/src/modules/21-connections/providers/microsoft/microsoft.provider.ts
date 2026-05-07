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
import { GraphMailService, MSFT_FETCH } from './graph-mail.service'

const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const GRAPH_ME_URL = 'https://graph.microsoft.com/v1.0/me'

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
}

@Injectable()
export class MicrosoftProvider implements IProvider {
  readonly name = 'microsoft' as const
  private readonly logger = new Logger(MicrosoftProvider.name)

  constructor(
    private readonly cfg: AppConfigService,
    private readonly mail: GraphMailService,
    @Optional() @Inject(MSFT_FETCH) private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async refresh(connection: DecryptedUserConnection): Promise<TokenRefreshResult> {
    if (connection.refreshToken === null) {
      throw new ConnectionRefreshExpiredError(connection.id)
    }
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
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
      if (errBody?.error === 'invalid_grant') {
        this.logger.warn(`Microsoft refresh invalid_grant`)
        throw new ConnectionRefreshExpiredError('microsoft')
      }
      throw new ConnectionAuthError(
        `Microsoft refresh falló: ${errBody?.error ?? res.status} ${errBody?.error_description ?? ''}`,
      )
    }

    const data = (await res.json()) as MicrosoftTokenResponse
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scopes: data.scope,
    }
  }

  async getProfile(accessToken: string): Promise<ProviderProfile> {
    const res = await this.fetchFn(GRAPH_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new ConnectionAuthError(`Graph /me falló con status ${res.status}`)
    }
    const me = (await res.json()) as GraphMeResponse
    return {
      externalAccountId: me.id,
      email: me.mail ?? me.userPrincipalName ?? null,
    }
  }

  async test(connection: DecryptedUserConnection): Promise<TestResult> {
    const to = connection.email
    if (!to) {
      throw new ConnectionAuthError('La conexión no tiene email asociado para enviar prueba')
    }
    await this.mail.sendMail(connection.accessToken, {
      to,
      subject: 'Test desde mapi',
      body: 'Si recibes este correo, tu integración con Outlook funciona.',
    })
    return { ok: true, message: `Test enviado a ${to}` }
  }
}
