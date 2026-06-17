import { Injectable } from '@nestjs/common'
import { APP_VERSION } from '@/common/version'

/** Shape del liveness check. Crece (db, redis, plugins cargados) cuando el core los integre. */
export interface HealthStatus {
  status: 'up'
  version: string
  env: string
  uptime_s: number
  timestamp: string
}

@Injectable()
export class HealthService {
  /**
   * Liveness básico: confirma que el core arrancó y responde — SIN ningún
   * plugin. Es la prueba de la propiedad #1 del sistema: el core bootea solo.
   * db/redis/plugins se agregan a la respuesta cuando el core los integre.
   */
  check(): HealthStatus {
    return {
      status: 'up',
      version: APP_VERSION,
      env: process.env.NODE_ENV ?? 'local',
      uptime_s: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }
}
