import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { AppConfigModule } from './core/config/config.module'
import { LoggerModule } from './core/logger/logger.module'
import { DbModule } from './core/db/db.module'
import { MetricsModule } from './core/metrics/metrics.module'
import { CorrelationIdMiddleware } from './common/correlation/correlation-id.middleware'
import { DomainErrorFilter } from './common/errors/domain-error.filter'
import { HealthModule } from './modules/health/health.module'
import { EventLogModule } from './modules/95-event-log/event-log.module'
import { AuthCoreModule } from './core/auth/auth-core.module'
import { JwtAuthGuard } from './core/auth/guards/jwt-auth.guard'
import { RolesGuard } from './core/auth/guards/roles.guard'
import { AuthModule } from './modules/10-core-auth/auth.module'
import { EncryptionModule } from './core/encryption/encryption.module'
import { IntuitOauthModule } from './modules/20-intuit-oauth/intuit-oauth.module'
import { ClientsModule } from './modules/11-clients/clients.module'
import { CustomerSupportModule } from './modules/12-customer-support/customer-support.module'
import { DashboardsModule } from './modules/13-dashboards/dashboards.module'
import { ConnectionsModule } from './modules/21-connections/connections.module'

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    DbModule,
    MetricsModule,
    AuthCoreModule,
    EncryptionModule,
    EventLogModule,
    AuthModule,
    ClientsModule,
    IntuitOauthModule,
    CustomerSupportModule,
    DashboardsModule,
    ConnectionsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: DomainErrorFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('{*splat}')
  }
}
