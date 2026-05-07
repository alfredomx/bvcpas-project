import { Injectable, Logger } from '@nestjs/common'
import { AppConfigService } from '../../../../core/config/config.service'
import type { DecryptedUserConnection } from '../../../../db/schema/user-connections'
import { IntuitOauthClientFactory } from '../../../20-intuit-oauth/intuit-oauth-client.factory'
import {
  IntuitAuthorizationError,
  IntuitRefreshTokenExpiredError,
} from '../../../20-intuit-oauth/intuit-oauth.errors'
import { ProviderApiError } from '../../connection.errors'
import type {
  IProvider,
  ProviderProfile,
  TestResult,
  TokenRefreshResult,
} from '../provider.interface'

/**
 * Provider Intuit. Implementa IProvider usando el SDK `intuit-oauth`
 * internamente (no fetch crudo).
 *
 * Reemplaza la combinación `IntuitOauthService` + `IntuitTokensService`
 * de v0.6.x para el refresh on-demand. El upsert/decrypt lo hace
 * `ConnectionsService` (genérico).
 *
 * `refresh` reusa `IntuitOauthClientFactory.applyToken` (D-mapi-v0.x-118)
 * para que el SDK valide internamente con `isRefreshTokenValid()` antes
 * de llamar Intuit.
 *
 * Importa de `20-intuit-oauth/` temporalmente; cuando ese módulo se
 * borre por completo (al final del bloque 5 de v0.8.0), el factory y
 * los errores se mueven aquí mismo.
 */
@Injectable()
export class IntuitProvider implements IProvider {
  readonly name = 'intuit' as const
  private readonly logger = new Logger(IntuitProvider.name)

  constructor(
    private readonly cfg: AppConfigService,
    private readonly oauthClientFactory: IntuitOauthClientFactory,
  ) {}

  /**
   * Refresca tokens via SDK Intuit. Devuelve plaintext; el caller
   * (`ConnectionTokenRefreshService`) cifra y persiste.
   *
   * Si Intuit responde `invalid_grant` o "refresh token is invalid":
   * IntuitRefreshTokenExpiredError. El caller convierte esto en HTTP 401
   * según STATUS_BY_CODE.
   */
  async refresh(connection: DecryptedUserConnection): Promise<TokenRefreshResult> {
    if (connection.refreshToken === null) {
      throw new IntuitRefreshTokenExpiredError(connection.clientId ?? connection.id)
    }
    if (connection.refreshTokenExpiresAt === null) {
      throw new IntuitAuthorizationError(
        `Intuit connection ${connection.id} sin refresh_token_expires_at; no se puede aplicar SDK.refresh()`,
      )
    }

    const oauthClient = this.oauthClientFactory.create()
    this.oauthClientFactory.applyToken(oauthClient, {
      realmId: connection.externalAccountId,
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      accessTokenExpiresAt: connection.accessTokenExpiresAt,
      refreshTokenExpiresAt: connection.refreshTokenExpiresAt,
    })

    let response
    try {
      response = await oauthClient.refresh()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message.toLowerCase() : ''
      const isExpired =
        errMsg.includes('invalid_grant') || errMsg.includes('refresh token is invalid')
      if (isExpired) {
        this.logger.warn(`Intuit refresh expirado para conn=${connection.id}`)
        throw new IntuitRefreshTokenExpiredError(connection.clientId ?? connection.id)
      }
      throw new IntuitAuthorizationError(
        `Intuit refresh falló: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    const { access_token, refresh_token, expires_in, x_refresh_token_expires_in } = response.token

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      refreshTokenExpiresIn: x_refresh_token_expires_in,
      // Intuit no devuelve scope en refresh; preservamos el original.
      scopes: connection.scopes,
    }
  }

  /**
   * Llama `companyinfo` de Intuit V3 con el realm de la conexión.
   * Devuelve `externalAccountId` (= realm_id) y `email` (no expuesto
   * por Intuit en este endpoint, así que null).
   *
   * Hoy NO se usa en runtime — el realm_id viene del callback OAuth
   * antes de tener una connection. Lo dejamos implementado por
   * completitud de la interfaz IProvider y para futuros casos donde
   * se necesite re-validar la conexión post-refresh.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getProfile(_accessToken: string): Promise<ProviderProfile> {
    throw new IntuitAuthorizationError(
      'IntuitProvider.getProfile no implementado: el realm_id se obtiene del callback OAuth, no por API',
    )
  }

  /**
   * Test de la conexión Intuit. Hace un GET a `companyinfo/{realmId}`,
   * que es el endpoint estándar para verificar conectividad sin
   * efectos secundarios.
   */
  async test(connection: DecryptedUserConnection): Promise<TestResult> {
    const realmId = connection.externalAccountId
    const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}?minorversion=${this.cfg.intuitMinorVersion}`

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new ProviderApiError(
        `Intuit companyinfo falló (${res.status})`,
        res.status,
        body.slice(0, 300),
      )
    }

    const data = (await res.json().catch(() => null)) as {
      CompanyInfo?: { CompanyName?: string; LegalName?: string }
    } | null
    const name = data?.CompanyInfo?.LegalName ?? data?.CompanyInfo?.CompanyName ?? realmId
    return {
      ok: true,
      message: `Conexión Intuit OK con ${name} (realm ${realmId})`,
    }
  }
}
