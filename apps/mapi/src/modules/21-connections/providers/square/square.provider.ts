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

export const SQUARE_FETCH = Symbol('SQUARE_FETCH')

const SQUARE_TOKEN_URL = 'https://connect.squareup.com/oauth2/token'
const SQUARE_API_BASE = 'https://connect.squareup.com/v2'

interface SquareTokenResponse {
  access_token: string
  token_type: string
  expires_at: string // ISO datetime, ej. "2026-06-07T22:19:44Z"
  merchant_id: string
  refresh_token: string
}

interface SquareMerchantResponse {
  merchant: {
    id: string
    business_name?: string
    country?: string
    language_code?: string
    currency?: string
    status?: string
    main_location_id?: string
  }
}

@Injectable()
export class SquareProvider implements IProvider {
  readonly name = 'square' as const
  private readonly logger = new Logger(SquareProvider.name)

  constructor(
    private readonly cfg: AppConfigService,
    @Optional() @Inject(SQUARE_FETCH) private readonly fetchFn: typeof fetch = fetch,
  ) {}

  /**
   * Square refresh: POST /oauth2/token con JSON body. Mismo endpoint que
   * el exchange. Defensivo: persistimos el refresh_token devuelto aunque
   * sea igual al actual (la doc es ambigua sobre rotación en code flow).
   *
   * Ver: https://developer.squareup.com/docs/oauth-api/refresh-revoke-limit-scope
   */
  async refresh(connection: DecryptedUserConnection): Promise<TokenRefreshResult> {
    if (!connection.refreshToken) {
      throw new ConnectionRefreshExpiredError(connection.id)
    }
    const res = await this.fetchFn(SQUARE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: this.cfg.squareClientId,
        client_secret: this.cfg.squareClientSecret,
        grant_type: 'refresh_token',
        refresh_token: connection.refreshToken,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      this.logger.warn(`Square refresh falló ${res.status}: ${body}`)
      // 401 / 400 con invalid_grant → refresh expirado.
      if (res.status === 401 || res.status === 400) {
        throw new ConnectionRefreshExpiredError(connection.id)
      }
      throw new ConnectionAuthError(`Square refresh falló (${res.status}): ${body}`)
    }
    const data = (await res.json()) as Partial<SquareTokenResponse>
    if (!data.access_token || !data.refresh_token || !data.expires_at) {
      throw new ConnectionAuthError(
        `Square refresh devolvió respuesta incompleta: ${JSON.stringify(data)}`,
      )
    }
    const nowSec = Math.floor(Date.now() / 1000)
    const expiresAtSec = Math.floor(new Date(data.expires_at).getTime() / 1000)
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: Math.max(0, expiresAtSec - nowSec),
      // refresh_token expira en 90 días (no documentado en response del refresh,
      // asumimos 90 días desde ahora).
      refreshTokenExpiresIn: 90 * 24 * 3600,
      scopes: connection.scopes,
    }
  }

  /**
   * GET /v2/merchants/me — devuelve info del merchant que autorizó el token.
   * Requiere scope MERCHANT_PROFILE_READ.
   */
  async getProfile(accessToken: string): Promise<ProviderProfile> {
    const res = await this.fetchFn(`${SQUARE_API_BASE}/merchants/me`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new ConnectionAuthError(`Square GET /merchants/me falló (${res.status}): ${body}`)
    }
    const data = (await res.json()) as SquareMerchantResponse
    return {
      externalAccountId: data.merchant.id,
      // Square no expone email del merchant en /merchants/me; queda null.
      email: null,
    }
  }

  async test(connection: DecryptedUserConnection): Promise<TestResult> {
    const profile = await this.getProfile(connection.accessToken)
    return {
      ok: true,
      message: `Merchant Square ${profile.externalAccountId} accesible`,
    }
  }
}
