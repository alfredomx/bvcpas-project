import { Module } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'
import { HealthModule } from '@/modules/health/health.module'

/**
 * Módulo raíz del CORE (host de plugins).
 *
 * En este corte (scaffold) sólo monta el logger (Pino) y el health — el core
 * bootea SOLO, sin ningún plugin. La infra (config, db, queue, qbo-client,
 * plugin-bridge, jwt-verify) y el plugin-loader se agregan pieza por pieza en
 * commits siguientes.
 *
 * REGLA DE ORO: este módulo NUNCA importa un plugin por nombre. Cuando entre
 * el plugin-loader, los plugins se montan por registro/manifiesto — el core
 * no conoce sus nombres ni sus entrañas.
 */
@Module({
  imports: [
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
