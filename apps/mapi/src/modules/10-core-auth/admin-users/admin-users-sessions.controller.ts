import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import { AdminUsersService } from './admin-users.service'
import { RevokeAllResponseDto, SessionsListResponseDto } from './dto/session.dto'

@ApiTags('Admin / Users')
@ApiBearerAuth('bearer')
@Controller('admin/users/:id/sessions')
@Roles('admin')
export class AdminUsersSessionsController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  @ApiOperation({
    summary: '/v1/admin/users/:id/sessions',
    description:
      'Devuelve todas las sesiones (activas + revocadas) del usuario. Útil para detectar dispositivos sospechosos.',
  })
  @ApiResponse({ status: 200, description: 'Lista de sesiones', type: SessionsListResponseDto })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async list(@Param('id', ParseUUIDPipe) userId: string): Promise<SessionsListResponseDto> {
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
    summary: '/v1/admin/users/:id/sessions/revoke-all',
    description:
      'Útil tras detectar laptop perdido o despido. Combinar con PATCH status=disabled para bloqueo permanente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sesiones revocadas',
    type: RevokeAllResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async revokeAll(
    @Param('id', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: SessionContext,
  ): Promise<RevokeAllResponseDto> {
    const count = await this.adminUsers.revokeAllSessions(userId, actor.userId)
    return { sessionsRevokedCount: count }
  }
}
