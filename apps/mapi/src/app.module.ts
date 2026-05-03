import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { AppConfigModule } from './core/config/config.module'
import { LoggerModule } from './core/logger/logger.module'
import { DbModule } from './core/db/db.module'
import { MetricsModule } from './core/metrics/metrics.module'
import { CorrelationIdMiddleware } from './common/correlation/correlation-id.middleware'
import { DomainErrorFilter } from './common/errors/domain-error.filter'
import { HealthModule } from './modules/health/health.module'

@Module({
  imports: [AppConfigModule, LoggerModule, DbModule, MetricsModule, HealthModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: DomainErrorFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('{*splat}')
  }
}
