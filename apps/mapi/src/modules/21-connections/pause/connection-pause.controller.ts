import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { RequirePermission } from '../../../core/permissions/decorators/require-permission.decorator'
import { PauseBodyDto, PauseBodySchema } from './dto/connection-pause.dto'
import { ConnectionPauseService } from './connection-pause.service'

/**
 * v0.14.0 — Pause/Resume manual de conexiones.
 *
 * Permite al dueño o usuario con share write marcar una conexión como pausada.
 * El dashboard de integraciones reporta esto como status `paused`.
 *
 * Workers/crons NO respetan `paused_at` todavía (D-mapi-054); cuando se necesite
 * se implementará en versión posterior.
 */
@ApiTags('Connections')
@ApiBearerAuth('bearer')
@Controller('connections/:id')
@RequirePermission('connections.update')
export class ConnectionPauseController {
  constructor(private readonly service: ConnectionPauseService) {}

  @Post('pause')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'POST /v1/connections/:id/pause',
    description:
      'Pausa la conexión. El dashboard la mostrará con status `paused`. Body opcional `{ reason }` para anotar contexto.',
  })
  @ApiResponse({ status: 204, description: 'Conexión pausada' })
  @ApiResponse({ status: 404, description: 'Conexión no encontrada o sin acceso write' })
  @ApiResponse({ status: 409, description: 'Conexión ya estaba pausada' })
  async pause(
    @Param('id', ParseUUIDPipe) connectionId: string,
    @Body(new ZodValidationPipe(PauseBodySchema)) body: PauseBodyDto,
    @CurrentUser() user: SessionContext,
  ): Promise<void> {
    await this.service.pause(connectionId, user.userId, body.reason ?? null)
  }

  @Post('resume')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'POST /v1/connections/:id/resume',
    description: 'Reanuda una conexión previamente pausada.',
  })
  @ApiResponse({ status: 204, description: 'Conexión reanudada' })
  @ApiResponse({ status: 404, description: 'Conexión no encontrada o sin acceso write' })
  @ApiResponse({ status: 409, description: 'Conexión no estaba pausada' })
  async resume(
    @Param('id', ParseUUIDPipe) connectionId: string,
    @CurrentUser() user: SessionContext,
  ): Promise<void> {
    await this.service.resume(connectionId, user.userId)
  }
}
