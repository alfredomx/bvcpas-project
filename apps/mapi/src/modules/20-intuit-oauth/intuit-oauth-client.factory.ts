import { Injectable } from '@nestjs/common'
import OAuthClient from 'intuit-oauth'
import type { OAuthClient as OAuthClientInstance } from 'intuit-oauth'
import { AppConfigService } from '../../core/config/config.service'
import type { DecryptedIntuitToken } from '../../db/schema/intuit-tokens'

/**
 * Wrapper sobre el SDK `intuit-oauth`. Crea instancias on-demand (no
 * singleton: setToken muta estado interno, así que cada flujo necesita su
 * propio cliente para no contaminarse).
 *
 * `applyToken` encapsula el fix D-mapi-v0.x-118: el SDK valida internamente
 * con `isRefreshTokenValid()` que necesita createdAt + x_refresh_token_expires_in.
 * Sin esos campos, el SDK lanza "Refresh token is invalid" antes de tocar
 * Intuit. Calculamos los 3 campos desde lo que está en DB.
 */
@Injectable()
export class IntuitOauthClientFactory {
  constructor(private readonly cfg: AppConfigService) {}

  create(): OAuthClientInstance {
    return new OAuthClient({
      clientId: this.cfg.intuitClientId,
      clientSecret: this.cfg.intuitClientSecret,
      environment: this.cfg.intuitEnvironment,
      redirectUri: this.cfg.intuitRedirectUri,
    })
  }

  applyToken(client: OAuthClientInstance, token: DecryptedIntuitToken): void {
    const nowMs = Date.now()
    const accessExpiresInSec = Math.max(
      0,
      Math.floor((token.accessTokenExpiresAt.getTime() - nowMs) / 1000),
    )
    const refreshExpiresInSec = Math.max(
      0,
      Math.floor((token.refreshTokenExpiresAt.getTime() - nowMs) / 1000),
    )

    client.setToken({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      realmId: token.realmId,
      createdAt: nowMs,
      expires_in: accessExpiresInSec,
      x_refresh_token_expires_in: refreshExpiresInSec,
      token_type: 'bearer',
    })
  }
}
