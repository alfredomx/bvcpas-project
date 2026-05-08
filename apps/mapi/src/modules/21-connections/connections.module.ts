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
import { DropboxFilesController } from './providers/dropbox/dropbox-files.controller'
import { DropboxFilesService } from './providers/dropbox/dropbox-files.service'
import { DropboxConnectionController } from './providers/dropbox/dropbox.controller'
import { DropboxProvider } from './providers/dropbox/dropbox.provider'
import { DropboxConnectionService } from './providers/dropbox/dropbox.service'
import { GoogleFilesController } from './providers/google/google-files.controller'
import { GoogleFilesService } from './providers/google/google-files.service'
import { GoogleConnectionController } from './providers/google/google.controller'
import { GoogleProvider } from './providers/google/google.provider'
import { GoogleConnectionService } from './providers/google/google.service'
import { IntuitProvider } from './providers/intuit/intuit.provider'
import { GraphMailService } from './providers/microsoft/graph-mail.service'
import { MicrosoftConnectionController } from './providers/microsoft/microsoft.controller'
import { MicrosoftProvider } from './providers/microsoft/microsoft.provider'
import { MicrosoftConnectionService } from './providers/microsoft/microsoft.service'

/**
 * Módulo 21-connections: conexiones a servicios externos.
 *
 * Versiones:
 * - v0.7.0 — Microsoft.
 * - v0.8.0 — Intuit (migrado desde 20-intuit-oauth) + scope_type + user_client_access.
 * - v0.9.0 — Dropbox + Google Drive (read-only OAuth + listing on-demand).
 *
 * Estructura: core genérico + plugins en `providers/<x>/`. Cada provider
 * implementa `IProvider` y opcionalmente expone su propio service/controller
 * para acciones específicas (mail Microsoft, files Dropbox/Google, etc.).
 *
 * NOTA TRANSICIONAL v0.8.0: `IntuitOauthClientFactory` se importa de
 * `20-intuit-oauth/`. Cuando 20-intuit-oauth/ se borre por completo, el
 * factory se mueve a `21-connections/providers/intuit/`.
 */
@Module({
  imports: [AppConfigModule, RedisModule, EncryptionModule, EventLogModule],
  controllers: [
    ConnectionsController,
    MicrosoftConnectionController,
    DropboxConnectionController,
    DropboxFilesController,
    GoogleConnectionController,
    GoogleFilesController,
  ],
  providers: [
    ConnectionsRepository,
    ConnectionsService,
    ConnectionTokenRefreshService,
    ProviderRegistry,
    // Microsoft
    GraphMailService,
    MicrosoftProvider,
    MicrosoftConnectionService,
    // Intuit (v0.8.0)
    IntuitOauthClientFactory,
    IntuitProvider,
    // Dropbox (v0.9.0)
    DropboxProvider,
    DropboxConnectionService,
    DropboxFilesService,
    // Google (v0.9.0)
    GoogleProvider,
    GoogleConnectionService,
    GoogleFilesService,
  ],
  exports: [
    ConnectionsService,
    ConnectionTokenRefreshService,
    ProviderRegistry,
    ConnectionsRepository,
  ],
})
export class ConnectionsModule {}
