import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { ClientAccessGuard } from '../../core/auth/guards/client-access.guard'
import { Roles } from '../../core/auth/decorators/roles.decorator'
import type { SessionContext } from '../../core/auth/sessions.service'
import {
  CreateCallLogBodyDto,
  CreateCallLogBodySchema,
  ListCallLogsQueryDto,
  ListCallLogsQuerySchema,
  type CallLogResponse,
  type ListCallLogsResponse,
  UpdateCallLogBodyDto,
  UpdateCallLogBodySchema,
} from './dto/call-logs.dto'
import { CallLogsService } from './call-logs.service'

@ApiTags('Clients - Call Logs')
@ApiBearerAuth('bearer')
@Controller('clients/:id/call-logs')
@Roles('admin')
@UseGuards(ClientAccessGuard)
export class CallLogsController {
  constructor(private readonly service: CallLogsService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'POST /v1/clients/:id/call-logs',
    description:
      'Registra una llamada al cliente. `user_id` se toma del JWT. `called_at` default = now() si no se manda.',
  })
  @ApiResponse({ status: 201, description: 'Call log creado.' })
  @ApiResponse({ status: 400, description: 'Body inválido (outcome fuera de enum o notes >2000).' })
  @ApiResponse({ status: 404, description: 'Cliente no existe o el usuario no tiene acceso.' })
  async create(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Body(new ZodValidationPipe(CreateCallLogBodySchema)) dto: CreateCallLogBodyDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<CallLogResponse> {
    return this.service.create(clientId, actor.userId, dto)
  }

  @Get()
  @ApiOperation({
    summary: 'GET /v1/clients/:id/call-logs',
    description:
      'Lista call logs del cliente ordenados por called_at DESC. Excluye soft-deleted. Paginación con limit/offset.',
  })
  @ApiResponse({ status: 200, description: 'Lista de call logs.' })
  async list(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Query(new ZodValidationPipe(ListCallLogsQuerySchema)) query: ListCallLogsQueryDto,
  ): Promise<ListCallLogsResponse> {
    return this.service.list(clientId, query)
  }

  @Patch(':logId')
  @ApiOperation({
    summary: 'PATCH /v1/clients/:id/call-logs/:logId',
    description:
      'Actualiza un call log. Al menos un campo requerido. Cualquier admin del despacho puede editarlo.',
  })
  @ApiResponse({ status: 200, description: 'Call log actualizado.' })
  @ApiResponse({ status: 400, description: 'Body inválido o sin campos.' })
  @ApiResponse({ status: 404, description: 'Call log no existe o ya fue eliminado.' })
  async update(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('logId', ParseUUIDPipe) logId: string,
    @Body(new ZodValidationPipe(UpdateCallLogBodySchema)) dto: UpdateCallLogBodyDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<CallLogResponse> {
    return this.service.update(logId, clientId, actor.userId, dto)
  }

  @Delete(':logId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'DELETE /v1/clients/:id/call-logs/:logId',
    description:
      'Hard delete del call log: lo elimina físicamente de la DB. El evento call_log.deleted queda en event_log para auditoría.',
  })
  @ApiResponse({ status: 204, description: 'Call log eliminado.' })
  @ApiResponse({ status: 404, description: 'Call log no existe.' })
  async delete(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('logId', ParseUUIDPipe) logId: string,
    @CurrentUser() actor: SessionContext,
  ): Promise<void> {
    await this.service.hardDelete(logId, clientId, actor.userId)
  }
}
