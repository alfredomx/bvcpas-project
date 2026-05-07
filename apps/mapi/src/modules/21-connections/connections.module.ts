import { Module } from '@nestjs/common'
import { AppConfigModule } from '../../core/config/config.module'
import { RedisModule } from '../../core/auth/redis.module'
import { EncryptionModule } from '../../core/encryption/encryption.module'
import { EventLogModule } from '../95-event-log/event-log.module'
import { IntuitOauthClientFactory } from '../20-intuit-oauth/intuit-oauth-client.factory'
import { ConnectionTokenRefreshService } from './connection-token-refresh.service'
import { ConnectionsController } from './connections.controller'
import { ConnectionsRepository } from './connections.repository'
import { ConnectionsService } from './connections.service'
import { ProviderRegistry } from './provider-registry.service'
import { IntuitProvider } from './providers/intuit/intuit.provider'
import { GraphMailService } from './providers/microsoft/graph-mail.service'
import { MicrosoftConnectionController } from './providers/microsoft/microsoft.controller'
import { MicrosoftProvider } from './providers/microsoft/microsoft.provider'
import { MicrosoftConnectionService } from './providers/microsoft/microsoft.service'

/**
 * Módulo 21-connections: conexiones a servicios externos.
 * v0.7.0 implementó Microsoft.
 * v0.8.0 agrega Intuit (migración desde 20-intuit-oauth).
 *
 * Estructura: core genérico + plugins en `providers/<x>/`.
 *
 * NOTA TRANSICIONAL v0.8.0: `IntuitOauthClientFactory` se importa de
 * `20-intuit-oauth/` (ese módulo todavía existe para los endpoints
 * legacy de OAuth, que serán refactorizados en sub-pasos siguientes).
 * Cuando 20-intuit-oauth/ se borre por completo, el factory se mueve
 * a `21-connections/providers/intuit/`.
 *
 * Endpoints (v0.7.0):
 * - GET    /v1/connections (lista, filtro provider)
 * - PATCH  /v1/connections/:id (editar label)
 * - DELETE /v1/connections/:id
 * - POST   /v1/connections/:id/test (delega al provider)
 * - POST   /v1/connections/microsoft/connect
 * - GET    /v1/connections/microsoft/callback (@Public)
 *
 * Endpoints v0.8.0 vendrán con el refactor URLs.
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
    // Intuit (v0.8.0)
    IntuitOauthClientFactory,
    IntuitProvider,
  ],
  exports: [ConnectionsService, ConnectionTokenRefreshService, ProviderRegistry],
})
export class ConnectionsModule {}
