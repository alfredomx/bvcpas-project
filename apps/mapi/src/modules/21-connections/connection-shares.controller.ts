import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import type { SessionContext } from '../../core/auth/sessions.service'
import { ConnectionsService } from './connections.service'
import {
  ConnectionShareDto,
  ListSharesResponseDto,
  ShareConnectionDto,
  UpdateShareDto,
} from './dto/connection-shares.dto'
import type { ShareWithUser } from './connection-access.repository'

function toShareDto(s: ShareWithUser): ConnectionShareDto {
  return {
    connection_id: s.connectionId,
    user_id: s.userId,
    permission: s.permission,
    user: {
      id: s.user.id,
      email: s.user.email,
      full_name: s.user.fullName,
    },
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  }
}

/**
 * Endpoints para gestionar quién puede usar una conexión además del dueño.
 *
 * Reglas (v0.10.0):
 * - Solo el dueño (`user_connections.user_id`) puede gestionar shares.
 * - El dueño NO aparece en la tabla `connection_access`.
 * - permission = 'read' | 'write'.
 */
@ApiTags('Connections')
@ApiBearerAuth('bearer')
@Controller('connections/:id/share')
export class ConnectionShareController {
  constructor(private readonly connections: ConnectionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'POST /v1/connections/:id/share',
    description:
      'Comparte la conexión con otro user. Solo el dueño puede llamarlo. ' +
      'Errores: 403 NOT_OWNER, 400 SHARE_SELF, 409 SHARE_DUPLICATE, 404 connection no existe.',
  })
  @ApiResponse({ status: 201, type: ConnectionShareDto })
  async share(
    @Param('id', ParseUUIDPipe) connectionId: string,
    @Body() body: ShareConnectionDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<ConnectionShareDto> {
    const result = await this.connections.share(
      connectionId,
      actor.userId,
      body.user_id,
      body.permission,
    )
    return toShareDto(result)
  }

  @Patch(':userId')
  @ApiOperation({
    summary: 'PATCH /v1/connections/:id/share/:userId',
    description: 'Cambia el permission de un share existente. Solo dueño.',
  })
  @ApiResponse({ status: 200, type: ConnectionShareDto })
  async update(
    @Param('id', ParseUUIDPipe) connectionId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Body() body: UpdateShareDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<ConnectionShareDto> {
    const result = await this.connections.updateSharePermission(
      connectionId,
      actor.userId,
      targetUserId,
      body.permission,
    )
    return toShareDto(result)
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'DELETE /v1/connections/:id/share/:userId',
    description: 'Quita un user de los compartidos. Solo dueño.',
  })
  @ApiResponse({ status: 204, description: 'Share removido' })
  async revoke(
    @Param('id', ParseUUIDPipe) connectionId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() actor: SessionContext,
  ): Promise<void> {
    await this.connections.revokeShare(connectionId, actor.userId, targetUserId)
  }
}

/**
 * GET separado en path `/connections/:id/shared` (no `/share`) para
 * evitar colisión con POST `/share`.
 */
@ApiTags('Connections')
@ApiBearerAuth('bearer')
@Controller('connections/:id/shared')
export class ConnectionShareListController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  @ApiOperation({
    summary: 'GET /v1/connections/:id/shared',
    description: 'Lista los users con quienes la conexión está compartida. Solo dueño.',
  })
  @ApiResponse({ status: 200, type: ListSharesResponseDto })
  async list(
    @Param('id', ParseUUIDPipe) connectionId: string,
    @CurrentUser() actor: SessionContext,
  ): Promise<ListSharesResponseDto> {
    const items = await this.connections.listShares(connectionId, actor.userId)
    return { items: items.map(toShareDto) }
  }
}
