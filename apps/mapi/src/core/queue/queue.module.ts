import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AppConfigModule } from '../config/config.module'
import { AppConfigService } from '../config/config.service'

/**
 * Infra de colas (capa worker). Registra BullMQ contra el mismo Redis del resto
 * de la app (`REDIS_URL`) y declara las colas. El dashboard (bull-board) se monta
 * en `main.ts` sobre estas colas, detrás de auth admin.
 *
 * Esta versión solo deja la **infra** lista (cola + dashboard). El wiring de las
 * descargas a la cola (encolar + worker + progreso) entra en la versión siguiente.
 */

/** Cola de descarga bancaria. Toda descarga (cheques/deposits/...) pasará por aquí. */
export const BANK_DOWNLOAD_QUEUE = 'bank-download'

/** Lista de colas registradas — el dashboard las muestra todas. */
export const REGISTERED_QUEUES = [BANK_DOWNLOAD_QUEUE] as const

/** Parsea `redis://[user:pass@]host:port[/db]` a opciones ioredis para BullMQ. */
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

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        connection: connectionFromUrl(cfg.redisUrl),
      }),
    }),
    ...REGISTERED_QUEUES.map((name) => BullModule.registerQueue({ name })),
  ],
  exports: [BullModule],
})
export class QueueModule {}
