import { Injectable } from '@nestjs/common'
import { collectDefaultMetrics, Counter, Gauge, Registry } from 'prom-client'
import { AppConfigService } from '../config/config.service'

/**
 * Wrapper sobre prom-client Registry. Cada módulo que necesite métricas
 * propias inyecta este servicio y registra contra `registry`.
 *
 * Métricas custom:
 * - `intuitTokensRefreshTotal`: contador de refreshes de tokens Intuit
 *   etiquetado por client_id y result (success/expired/failed).
 * - `intuitRefreshTokenDaysUntilExpiry`: gauge con días hasta expiración
 *   del refresh_token por cliente. Cron de v0.3.0 lo actualiza cada hora.
 * - `intuitApiCallsTotal`: contador de calls al proxy V3 por path y status.
 */
@Injectable()
export class MetricsService {
  readonly registry: Registry
  readonly intuitTokensRefreshTotal: Counter<'client_id' | 'result'>
  readonly intuitRefreshTokenDaysUntilExpiry: Gauge<'client_id' | 'realm_id'>
  readonly intuitApiCallsTotal: Counter<'path' | 'status'>

  constructor(cfg: AppConfigService) {
    this.registry = new Registry()
    this.registry.setDefaultLabels({ app: 'mapi', env: cfg.nodeEnv })
    collectDefaultMetrics({ register: this.registry })

    this.intuitTokensRefreshTotal = new Counter({
      name: 'intuit_tokens_refresh_total',
      help: 'Total de refreshes de tokens Intuit',
      labelNames: ['client_id', 'result'] as const,
      registers: [this.registry],
    })

    this.intuitRefreshTokenDaysUntilExpiry = new Gauge({
      name: 'intuit_refresh_token_days_until_expiry',
      help: 'Días hasta que el refresh_token Intuit expire',
      labelNames: ['client_id', 'realm_id'] as const,
      registers: [this.registry],
    })

    this.intuitApiCallsTotal = new Counter({
      name: 'intuit_api_calls_total',
      help: 'Total de calls al proxy V3 de Intuit',
      labelNames: ['path', 'status'] as const,
      registers: [this.registry],
    })
  }

  metrics(): Promise<string> {
    return this.registry.metrics()
  }

  contentType(): string {
    return this.registry.contentType
  }
}
