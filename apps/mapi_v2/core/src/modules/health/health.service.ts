import { Inject, Injectable } from '@nestjs/common'
import type { Sql } from 'postgres'
import { DB_CLIENT } from '@/core/db/db.module'
import { APP_VERSION } from '@/common/version'

export interface ComponentStatus {
  status: 'up' | 'down'
  latency_ms: number
}

/** Shape del liveness check. Crece (redis, plugins cargados) cuando el core los integre. */
export interface HealthStatus {
  status: 'up' | 'degraded'
  version: string
  env: string
  uptime_s: number
  timestamp: string
  components: {
    db: ComponentStatus
  }
}

@Injectable()
export class HealthService {
  constructor(@Inject(DB_CLIENT) private readonly db: Sql) {}

  /**
   * Liveness del core: confirma que arrancó y que la DB responde. Redis y
   * plugins cargados se agregan a `components` cuando esas piezas entren.
   */
  async check(): Promise<HealthStatus> {
    const db = await this.pingDb()
    return {
      status: db.status === 'up' ? 'up' : 'degraded',
      version: APP_VERSION,
      env: process.env.NODE_ENV ?? 'local',
      uptime_s: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      components: { db },
    }
  }

  private async pingDb(): Promise<ComponentStatus> {
    const start = Date.now()
    try {
      await this.db`select 1`
      return { status: 'up', latency_ms: Date.now() - start }
    } catch {
      return { status: 'down', latency_ms: Date.now() - start }
    }
  }
}
