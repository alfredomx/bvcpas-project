import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { AppConfigService } from '../../../core/config/config.service'
import { MicrosoftAuthError, MicrosoftRefreshExpiredError } from '../microsoft-oauth.errors'
import { MicrosoftTokensService } from './microsoft-tokens.service'

export const MSFT_FETCH = Symbol('MSFT_FETCH')

const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const REFRESH_BUFFER_MS = 5 * 60 * 1000 // 5 min

interface MicrosoftTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
  token_type: string
}

interface MicrosoftErrorResponse {
  error: string
  error_description?: string
}

/**
 * Devuelve un access_token vigente para llamar Microsoft Graph. Refresca
 * on-demand si el token actual expira en <5 min. Microsoft rota el
 * refresh_token al refrescar — el nuevo se persiste.
 */
@Injectable()
export class MicrosoftTokenRefreshService {
  private readonly logger = new Logger(MicrosoftTokenRefreshService.name)

  constructor(
    private readonly tokens: MicrosoftTokensService,
    private readonly cfg: AppConfigService,
    @Optional() @Inject(MSFT_FETCH) private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async getValidAccessToken(userId: string): Promise<string> {
    const decrypted = await this.tokens.getDecryptedByUserId(userId)
    const msUntilExpiry = decrypted.accessTokenExpiresAt.getTime() - Date.now()
    if (msUntilExpiry > REFRESH_BUFFER_MS) {
      return decrypted.accessToken
    }

    const response = await this.refresh(decrypted.refreshToken, userId)
    const newExpiresAt = new Date(Date.now() + response.expires_in * 1000)

    await this.tokens.upsert({
      userId: decrypted.userId,
      microsoftUserId: decrypted.microsoftUserId,
      email: decrypted.email,
      scopes: response.scope || decrypted.scopes,
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      accessTokenExpiresAt: newExpiresAt,
    })

    return response.access_token
  }

  private async refresh(refreshToken: string, userId: string): Promise<MicrosoftTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.cfg.microsoftClientId,
      client_secret: this.cfg.microsoftClientSecret,
    })

    const res = await this.fetchFn(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) {
      const errBody = (await res.json().catch(() => null)) as MicrosoftErrorResponse | null
      if (errBody?.error === 'invalid_grant') {
        this.logger.warn(`Microsoft refresh invalid_grant para user=${userId}`)
        throw new MicrosoftRefreshExpiredError(userId)
      }
      throw new MicrosoftAuthError(
        `Microsoft refresh falló: ${errBody?.error ?? res.status} ${errBody?.error_description ?? ''}`,
      )
    }

    return (await res.json()) as MicrosoftTokenResponse
  }
}
