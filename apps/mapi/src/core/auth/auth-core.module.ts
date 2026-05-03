import { Global, Module } from '@nestjs/common'
import { AppConfigModule } from '../config/config.module'
import { RedisModule } from './redis.module'
import { PasswordService } from './password.service'
import { JwtService } from './jwt.service'
import { SessionsService } from './sessions.service'

/**
 * Módulo global core de auth: provee los 3 servicios fundamentales que
 * usan los módulos de dominio (auth/, admin-users/, admin-sessions/) y
 * los guards.
 *
 * Heredado D-053 mapi v0.x: @Global() para inyección sin import explícito.
 */
@Global()
@Module({
  imports: [AppConfigModule, RedisModule],
  providers: [PasswordService, JwtService, SessionsService],
  exports: [PasswordService, JwtService, SessionsService],
})
export class AuthCoreModule {}
