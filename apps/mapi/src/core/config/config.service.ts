import { Injectable } from '@nestjs/common'
import type { AppConfig } from './config.schema'

/**
 * Wrapper tipado sobre las env vars validadas. Inyectable en cualquier
 * módulo. Las propiedades son de solo lectura.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly cfg: AppConfig) {}

  get nodeEnv(): AppConfig['NODE_ENV'] {
    return this.cfg.NODE_ENV
  }

  get port(): number {
    return this.cfg.PORT
  }

  get logLevel(): AppConfig['LOG_LEVEL'] {
    return this.cfg.LOG_LEVEL
  }

  get publicUrl(): string | undefined {
    return this.cfg.PUBLIC_URL
  }

  get lokiUrl(): string | undefined {
    return this.cfg.LOKI_URL
  }

  get databaseUrl(): string {
    return this.cfg.DATABASE_URL
  }

  get isLocal(): boolean {
    return this.cfg.NODE_ENV === 'local'
  }

  get isProduction(): boolean {
    return this.cfg.NODE_ENV === 'production'
  }

  get isTest(): boolean {
    return this.cfg.NODE_ENV === 'test'
  }

  get jwtSecret(): string {
    return this.cfg.JWT_SECRET
  }

  get jwtExpiresIn(): string {
    return this.cfg.JWT_EXPIRES_IN
  }

  get bcryptCost(): number {
    return this.cfg.BCRYPT_COST
  }

  get redisUrl(): string {
    return this.cfg.REDIS_URL
  }

  get encryptionKey(): string {
    return this.cfg.ENCRYPTION_KEY
  }

  get intuitClientId(): string {
    return this.cfg.INTUIT_CLIENT_ID
  }

  get intuitClientSecret(): string {
    return this.cfg.INTUIT_CLIENT_SECRET
  }

  get intuitRedirectUri(): string {
    return this.cfg.INTUIT_REDIRECT_URI
  }

  get intuitEnvironment(): AppConfig['INTUIT_ENVIRONMENT'] {
    return this.cfg.INTUIT_ENVIRONMENT
  }

  get intuitMinorVersion(): number {
    return this.cfg.INTUIT_MINOR_VERSION
  }

  get microsoftClientId(): string {
    return this.cfg.MICROSOFT_CLIENT_ID
  }

  get microsoftClientSecret(): string {
    return this.cfg.MICROSOFT_CLIENT_SECRET
  }

  get microsoftRedirectUri(): string {
    return this.cfg.MICROSOFT_REDIRECT_URI
  }
}
