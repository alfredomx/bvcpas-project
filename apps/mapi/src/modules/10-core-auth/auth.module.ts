import { Module } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AdminUsersController } from './admin-users/admin-users.controller'
import { AdminUsersSessionsController } from './admin-users/admin-users-sessions.controller'
import { AdminUsersService } from './admin-users/admin-users.service'
import { AdminSessionsController } from './admin-sessions/admin-sessions.controller'
import { AdminSessionsService } from './admin-sessions/admin-sessions.service'

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
  ],
  controllers: [
    AuthController,
    AdminUsersController,
    AdminUsersSessionsController,
    AdminSessionsController,
  ],
  providers: [AuthService, AdminUsersService, AdminSessionsService],
})
export class AuthModule {}
