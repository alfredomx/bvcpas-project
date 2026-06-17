import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'
import { AppConfigModule } from '@/core/config/config.module'
import { DbModule } from '@/core/db/db.module'
import { RedisModule } from '@/core/redis/redis.module'
import { QueueModule } from '@/core/queue/queue.module'
import { CorrelationIdMiddleware } from '@/common/correlation/correlation-id.middleware'
import { getCorrelationId } from '@/common/correlation/correlation.context'
import { HealthModule } from '@/modules/health/health.module'
import { REGISTRY, registryModules } from '@/registry/registry'

/**
 * Módulo raíz del CORE (host de plugins).
 *
 * Infra montada: config (env validado por Zod) + db (Drizzle) + redis (ioredis)
 * + queue (BullMQ root) + errores/validación (DomainErrorFilter, ZodPipe) +
 * logger (Pino con correlation_id). El core bootea SOLO, sin ningún plugin.
 * qbo-client, plugin-bridge, jwt-verify y el plugin-loader se agregan pieza por
 * pieza en commits siguientes.
 *
 * REGLA DE ORO: este módulo NUNCA importa un plugin por nombre. Los plugins y
 * pipes se montan expandiendo `registryModules(REGISTRY)` — el core no conoce
 * sus nombres ni sus entrañas, solo monta la lista de manifiestos.
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
        customProps: () => {
          const correlationId = getCorrelationId()
          return correlationId ? { correlation_id: correlationId } : {}
        },
      },
    }),
    HealthModule,
    // Units (plugins/pipes) del registro. Vacío hoy → el core arranca solo.
    ...registryModules(REGISTRY),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*')
  }
}
