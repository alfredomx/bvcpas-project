import { Module } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'
import { AppConfigModule } from '@/core/config/config.module'
import { DbModule } from '@/core/db/db.module'
import { RedisModule } from '@/core/redis/redis.module'
import { QueueModule } from '@/core/queue/queue.module'
import { HealthModule } from '@/modules/health/health.module'

/**
 * Módulo raíz del CORE (host de plugins).
 *
 * Infra montada: config (env validado por Zod) + db (Drizzle) + redis (ioredis)
 * + queue (BullMQ root) + logger (Pino). El core bootea SOLO, sin ningún plugin.
 * qbo-client, plugin-bridge, jwt-verify y el plugin-loader se agregan pieza por
 * pieza en commits siguientes.
 *
 * REGLA DE ORO: este módulo NUNCA importa un plugin por nombre. Cuando entre
 * el plugin-loader, los plugins se montan por registro/manifiesto — el core
 * no conoce sus nombres ni sus entrañas.
 */
@Module({
  imports: [
    AppConfigModule,
    DbModule,
    RedisModule,
    QueueModule,
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        customLogLevel: (_req, res) => (res.statusCode >= 500 ? 'error' : 'info'),
      },
    }),
    HealthModule,
  ],
})
export class AppModule {}
