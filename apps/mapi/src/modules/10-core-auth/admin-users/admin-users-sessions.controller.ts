import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import { AdminSessionsService } from '../admin-sessions/admin-sessions.service'
import { AdminUsersService } from './admin-users.service'
import { RevokeAllResponseDto, SessionsListResponseDto } from './dto/session.dto'

@ApiTags('Users')
@ApiBearerAuth('bearer')
@Controller('users/:userId/sessions')
@Roles('admin')
export class AdminUsersSessionsController {
  constructor(
    private readonly adminUsers: AdminUsersService,
    private readonly adminSessions: AdminSessionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '/v1/users/:userId/sessions',
    description:
      'Devuelve todas las sesiones (activas + revocadas) del usuario. Útil para detectar dispositivos sospechosos.',
  })
  @ApiResponse({ status: 200, description: 'Lista de sesiones', type: SessionsListResponseDto })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async list(@Param('userId', ParseUUIDPipe) userId: string): Promise<SessionsListResponseDto> {
    const sessions = await this.adminUsers.listSessions(userId)
    return {
      items: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.createdAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
        expiresAt: s.expiresAt.toISOString(),
      })),
    }
  }

  @Post('revoke-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '/v1/users/:userId/sessions/revoke-all',
    description:
      'Revoca TODAS las sesiones del usuario. Útil tras detectar laptop perdido o despido. Combinar con PATCH status=disabled para bloqueo permanente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sesiones revocadas',
    type: RevokeAllResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async revokeAll(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: SessionContext,
  ): Promise<RevokeAllResponseDto> {
    const count = await this.adminUsers.revokeAllSessions(userId, actor.userId)
    return { sessionsRevokedCount: count }
  }

  @Patch(':sessionId/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '/v1/users/:userId/sessions/:sessionId/revoke',
    description:
      'Revoca una sesión individual por su id. La próxima request del usuario en ese dispositivo fallará con 401 SESSION_REVOKED.',
  })
  @ApiResponse({ status: 204, description: 'Sesión revocada' })
  @ApiResponse({ status: 404, description: 'Sesión no encontrada' })
  async revokeOne(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @CurrentUser() actor: SessionContext,
  ): Promise<void> {
    void userId // path consistency only — sessionId UUID es único globalmente
    await this.adminSessions.revoke(sessionId, actor.userId)
  }
}
