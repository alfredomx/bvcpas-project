import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { AppConfigModule } from './core/config/config.module'
import { LoggerModule } from './core/logger/logger.module'
import { CorrelationIdMiddleware } from './common/correlation/correlation-id.middleware'
import { DomainErrorFilter } from './common/errors/domain-error.filter'

@Module({
  imports: [AppConfigModule, LoggerModule],
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
