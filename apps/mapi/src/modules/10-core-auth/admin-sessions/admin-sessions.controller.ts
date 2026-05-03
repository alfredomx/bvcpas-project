import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import { AdminSessionsService } from './admin-sessions.service'

@ApiTags('Admin / Sessions')
@ApiBearerAuth('bearer')
@Controller('admin/sessions')
@Roles('admin')
export class AdminSessionsController {
  constructor(private readonly admin: AdminSessionsService) {}

  @Patch(':id/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '/v1/admin/sessions/:id/revoke',
    description:
      'Revoca una sesión individual por su id. La próxima request del usuario en ese dispositivo fallará con 401 SESSION_REVOKED.',
  })
  @ApiResponse({ status: 204, description: 'Sesión revocada' })
  @ApiResponse({ status: 404, description: 'Sesión no encontrada' })
  async revoke(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @CurrentUser() actor: SessionContext,
  ): Promise<void> {
    await this.admin.revoke(sessionId, actor.userId)
  }
}
