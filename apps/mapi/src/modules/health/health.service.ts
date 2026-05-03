import { Inject, Injectable } from '@nestjs/common'
import type { Sql } from 'postgres'
import { DB_CLIENT } from '../../core/db/db.module'
import { AppConfigService } from '../../core/config/config.service'
import { APP_VERSION } from '../../common/version'

export interface ComponentHealth {
  status: 'up' | 'down'
  latency_ms?: number
  error?: string
}

export interface HealthReport {
  status: 'up' | 'down'
  version: string
  env: 'local' | 'test' | 'production'
  uptime_s: number
  timestamp: string
  components: {
    db: ComponentHealth
  }
}

/**
 * Verifica que los componentes externos del que mapi depende están vivos.
 * Por ahora sólo Postgres. Redis se agrega cuando entre BullMQ.
 */
@Injectable()
export class HealthService {
  constructor(
    @Inject(DB_CLIENT) private readonly db: Sql,
    private readonly cfg: AppConfigService,
  ) {}

  async check(): Promise<HealthReport> {
    const dbHealth = await this.checkDb()

    return {
      status: dbHealth.status === 'up' ? 'up' : 'down',
      version: APP_VERSION,
      env: this.cfg.nodeEnv,
      uptime_s: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      components: {
        db: dbHealth,
      },
    }
  }

  private async checkDb(): Promise<ComponentHealth> {
    const start = Date.now()
    try {
      await this.db`SELECT 1`
      return { status: 'up', latency_ms: Date.now() - start }
    } catch (err: unknown) {
      return {
        status: 'down',
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
