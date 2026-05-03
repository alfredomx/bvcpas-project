import { Global, Module } from '@nestjs/common'
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino'
import { AppConfigModule } from '../config/config.module'
import { AppConfigService } from '../config/config.service'
import { getCorrelationId } from '../../common/correlation/correlation.context'

/**
 * Pino logger global con:
 * - pino-pretty cuando NODE_ENV=local (legible en consola).
 * - JSON crudo cuando NODE_ENV=production (parseable por Loki).
 * - silent cuando NODE_ENV=test (no contamina output de jest).
 *
 * Inyecta automáticamente `correlation_id` en cada log usando el mixin
 * que lee de AsyncLocalStorage.
 *
 * autoLogging filtra paths internos de healthcheck (ruido en prod).
 */
@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        pinoHttp: {
          level: cfg.isTest ? 'silent' : cfg.logLevel,
          transport: cfg.isLocal
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:HH:MM:ss.l',
                  singleLine: false,
                  ignore: 'pid,hostname,req,res,responseTime',
                },
              }
            : undefined,
          mixin() {
            const correlationId = getCorrelationId()
            return correlationId ? { correlation_id: correlationId } : {}
          },
          autoLogging: {
            ignore: (req) => {
              const url = req.url ?? ''
              return url.startsWith('/v1/healthz') || url === '/healthz'
            },
          },
          customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
          customErrorMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
          serializers: {
            req: (req: { method: string; url: string }) => ({
              method: req.method,
              url: req.url,
            }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
