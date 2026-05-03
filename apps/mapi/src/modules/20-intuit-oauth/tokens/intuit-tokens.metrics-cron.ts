import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { MetricsService } from '../../../core/metrics/metrics.service'
import { IntuitTokensRepository } from './intuit-tokens.repository'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Cada hora calcula los días restantes hasta que el refresh_token de cada
 * cliente expire y actualiza `intuit_refresh_token_days_until_expiry`.
 *
 * El gauge es lo que más necesita auto-actualización: aunque no haya
 * actividad (calls, refreshes), los días siguen pasando. Sin el cron, el
 * gauge se queda estancado y engaña a las alertas.
 *
 * Resiliente: si el repo lanza, swallow + log.warn (no tirar la app por
 * un fallo en métricas).
 */
@Injectable()
export class IntuitTokensMetricsCron implements OnApplicationBootstrap {
  private readonly logger = new Logger(IntuitTokensMetricsCron.name)

  constructor(
    private readonly repo: IntuitTokensRepository,
    private readonly metrics: MetricsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.updateGauge()
  }

  @Cron(CronExpression.EVERY_HOUR)
  async updateGauge(): Promise<void> {
    try {
      const all = await this.repo.listAll()
      const now = Date.now()
      for (const t of all) {
        const daysLeft = Math.floor((t.refreshTokenExpiresAt.getTime() - now) / MS_PER_DAY)
        this.metrics.intuitRefreshTokenDaysUntilExpiry.set(
          { client_id: t.clientId, realm_id: t.realmId },
          daysLeft,
        )
      }
      this.logger.debug(`tokens metrics updated: ${all.length} clientes`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.warn(`Failed to update tokens metrics gauge: ${msg}`)
    }
  }
}
