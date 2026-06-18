import { Global, Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AppConfigModule } from '@/core/config/config.module'
import { AppConfigService } from '@/core/config/config.service'
import { QueueBoardRegistry } from './queue-board.registry'

/**
 * Convierte una REDIS_URL (`redis://[user:pass@]host:port/db`) en las opciones
 * de conexión que BullMQ/ioredis esperan. El path (`/3`) se interpreta como el
 * índice de base de datos Redis.
 */
export function connectionFromUrl(redisUrl: string): {
  host: string
  port: number
  db: number
  username?: string
  password?: string
} {
  const u = new URL(redisUrl)
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) || 0 : 0,
    ...(u.username ? { username: u.username } : {}),
    ...(u.password ? { password: u.password } : {}),
  }
}

/**
 * Infra de colas del CORE (host).
 *
 * Solo registra la conexión raíz de BullMQ y reexporta BullModule. NO registra
 * ninguna cola de dominio (`bank-download`, etc.): esas pertenecen a cada
 * plugin, que las declara con `BullModule.registerQueue(...)` en su propio
 * módulo. El core provee la conexión; el plugin provee sus colas.
 *
 * `@Global` + exporta el `QueueBoardRegistry`: cada plugin/pipe con cola registra
 * su nombre ahí (cero-reach) para que el bootstrap monte bull-board con todas.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        connection: connectionFromUrl(cfg.redisUrl),
      }),
    }),
  ],
  providers: [QueueBoardRegistry],
  exports: [BullModule, QueueBoardRegistry],
})
export class QueueModule {}
