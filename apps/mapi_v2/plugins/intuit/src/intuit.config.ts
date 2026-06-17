import { Injectable } from '@nestjs/common'
import { z } from 'zod'

/**
 * Config (env vars) del plugin Intuit. El registro del core valida este Zod
 * contra `process.env` al boot (fail-fast). El mismo schema lo reusa
 * `IntuitConfigService` para proveer la config tipada en runtime.
 */
export const intuitConfigSchema = z.object({
  INTUIT_CLIENT_ID: z.string().min(1),
  INTUIT_CLIENT_SECRET: z.string().min(1),
  INTUIT_REDIRECT_URI: z.string().url(),
  INTUIT_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  INTUIT_MINOR_VERSION: z.coerce.number().int().positive().default(75),
})

export type IntuitConfig = z.infer<typeof intuitConfigSchema>

const PROD_API = 'https://quickbooks.api.intuit.com/v3'
const SANDBOX_API = 'https://sandbox-quickbooks.api.intuit.com/v3'
const OAUTH_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2'

/** Config tipada del plugin, inyectable. Parsea `process.env` con el schema. */
@Injectable()
export class IntuitConfigService {
  private readonly cfg: IntuitConfig

  constructor() {
    this.cfg = intuitConfigSchema.parse(process.env)
  }

  get clientId(): string {
    return this.cfg.INTUIT_CLIENT_ID
  }

  get clientSecret(): string {
    return this.cfg.INTUIT_CLIENT_SECRET
  }

  get redirectUri(): string {
    return this.cfg.INTUIT_REDIRECT_URI
  }

  get minorVersion(): number {
    return this.cfg.INTUIT_MINOR_VERSION
  }

  /** Base de la API V3 según el entorno. */
  get apiBaseUrl(): string {
    return this.cfg.INTUIT_ENVIRONMENT === 'production' ? PROD_API : SANDBOX_API
  }

  get oauthTokenUrl(): string {
    return OAUTH_TOKEN_URL
  }

  get authorizeUrl(): string {
    return AUTHORIZE_URL
  }
}
