import { Module } from '@nestjs/common'
import { AppConfigModule } from '../../core/config/config.module'
import { RedisModule } from '../../core/auth/redis.module'
import { EncryptionModule } from '../../core/encryption/encryption.module'
import { EventLogModule } from '../95-event-log/event-log.module'
import { GraphMailService } from './graph/graph-mail.service'
import { MicrosoftOauthController } from './oauth/microsoft-oauth.controller'
import { MicrosoftOauthService } from './oauth/microsoft-oauth.service'
import { MicrosoftTokenRefreshService } from './tokens/microsoft-token-refresh.service'
import { MicrosoftTokensRepository } from './tokens/microsoft-tokens.repository'
import { MicrosoftTokensService } from './tokens/microsoft-tokens.service'

/**
 * Módulo 21-microsoft-oauth: OAuth + tokens cifrados + envío de mail vía
 * Microsoft Graph. Por usuario (1 user = 1 Outlook).
 *
 * Endpoints expuestos (todos bajo prefix global v1):
 * - POST /v1/microsoft-oauth/connect — devuelve URL de consent.
 * - GET  /v1/microsoft-oauth/callback — @Public, recibe code+state.
 * - GET  /v1/microsoft-oauth/me — estado de conexión del usuario actual.
 * - DELETE /v1/microsoft-oauth/me — desconectar.
 * - POST /v1/microsoft-oauth/test-email — envío de prueba al propio email.
 */
@Module({
  imports: [AppConfigModule, RedisModule, EncryptionModule, EventLogModule],
  controllers: [MicrosoftOauthController],
  providers: [
    MicrosoftTokensRepository,
    MicrosoftTokensService,
    MicrosoftTokenRefreshService,
    MicrosoftOauthService,
    GraphMailService,
  ],
  exports: [MicrosoftTokensService, GraphMailService],
})
export class MicrosoftOauthModule {}
