import { Module } from '@nestjs/common'
import { AppConfigModule } from '../../core/config/config.module'
import { RedisModule } from '../../core/auth/redis.module'
import { EncryptionModule } from '../../core/encryption/encryption.module'
import { EventLogModule } from '../95-event-log/event-log.module'
import { ConnectionTokenRefreshService } from './connection-token-refresh.service'
import { ConnectionsController } from './connections.controller'
import { ConnectionsRepository } from './connections.repository'
import { ConnectionsService } from './connections.service'
import { ProviderRegistry } from './provider-registry.service'
import { GraphMailService } from './providers/microsoft/graph-mail.service'
import { MicrosoftConnectionController } from './providers/microsoft/microsoft.controller'
import { MicrosoftProvider } from './providers/microsoft/microsoft.provider'
import { MicrosoftConnectionService } from './providers/microsoft/microsoft.service'

/**
 * Módulo 21-connections (v0.7.0): conexiones a servicios externos por
 * usuario, multi-cuenta, multi-provider. Reemplaza al
 * `21-microsoft-oauth` de v0.6.2.
 *
 * Estructura: core genérico + plugins en `providers/<x>/`. v0.7.0
 * implementa Microsoft. Google y Dropbox vienen en v0.7.1 / v0.7.2.
 *
 * Endpoints:
 * - GET    /v1/connections (lista, filtro provider)
 * - PATCH  /v1/connections/:id (editar label)
 * - DELETE /v1/connections/:id
 * - POST   /v1/connections/:id/test (delega al provider)
 * - POST   /v1/connections/microsoft/connect
 * - GET    /v1/connections/microsoft/callback (@Public)
 */
@Module({
  imports: [AppConfigModule, RedisModule, EncryptionModule, EventLogModule],
  controllers: [ConnectionsController, MicrosoftConnectionController],
  providers: [
    ConnectionsRepository,
    ConnectionsService,
    ConnectionTokenRefreshService,
    ProviderRegistry,
    GraphMailService,
    MicrosoftProvider,
    MicrosoftConnectionService,
  ],
  exports: [ConnectionsService, ConnectionTokenRefreshService, ProviderRegistry],
})
export class ConnectionsModule {}
