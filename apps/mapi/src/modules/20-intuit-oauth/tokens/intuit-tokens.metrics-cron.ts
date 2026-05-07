import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { eq } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../../core/db/db.module'
import { userConnections } from '../../../db/schema/user-connections'
import { MetricsService } from '../../../core/metrics/metrics.service'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Cada hora calcula los días restantes hasta que el refresh_token de cada
 * conexión Intuit expire y actualiza `intuit_refresh_token_days_until_expiry`.
 *
 * v0.8.0: lee de `user_connections WHERE provider='intuit'` en vez de
 * la tabla legacy `intuit_tokens`. Filtra rows con
 * `refresh_token_expires_at IS NOT NULL` (Intuit siempre lo expone, pero
 * el schema lo permite null por compatibilidad con otros providers).
 *
 * `client_id` para el label puede ser null en teoría (la columna es
 * nullable), pero para Intuit siempre debe estar — si llega a faltar,
 * usamos el `id` de la connection como fallback.
 *
 * El gauge es lo que más necesita auto-actualización: aunque no haya
 * actividad (calls, refreshes), los días siguen pasando.
 *
 * Resiliente: si la query lanza, swallow + log.warn (no tirar la app
 * por un fallo en métricas).
 */
@Injectable()
export class IntuitTokensMetricsCron implements OnApplicationBootstrap {
  private readonly logger = new Logger(IntuitTokensMetricsCron.name)

  constructor(
    @Inject(DB) private readonly db: DrizzleDb,
    private readonly metrics: MetricsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.updateGauge()
  }

  @Cron(CronExpression.EVERY_HOUR)
  async updateGauge(): Promise<void> {
    try {
      const rows = await this.db
        .select({
          id: userConnections.id,
          clientId: userConnections.clientId,
          externalAccountId: userConnections.externalAccountId,
          refreshTokenExpiresAt: userConnections.refreshTokenExpiresAt,
        })
        .from(userConnections)
        .where(eq(userConnections.provider, 'intuit'))
      const now = Date.now()
      let updated = 0
      for (const t of rows) {
        if (t.refreshTokenExpiresAt === null) continue
        const daysLeft = Math.floor((t.refreshTokenExpiresAt.getTime() - now) / MS_PER_DAY)
        this.metrics.intuitRefreshTokenDaysUntilExpiry.set(
          { client_id: t.clientId ?? t.id, realm_id: t.externalAccountId },
          daysLeft,
        )
        updated++
      }
      this.logger.debug(`tokens metrics updated: ${updated} conexiones intuit`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.warn(`Failed to update tokens metrics gauge: ${msg}`)
    }
  }
}
