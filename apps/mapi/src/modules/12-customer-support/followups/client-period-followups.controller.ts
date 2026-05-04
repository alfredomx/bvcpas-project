import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import {
  FollowupDto,
  FollowupQueryDto,
  FollowupQuerySchema,
  UpdateFollowupDto,
  UpdateFollowupSchema,
} from '../dto/customer-support.dto'
import { ClientPeriodFollowupsService, type FollowupView } from './client-period-followups.service'

function serialize(v: FollowupView): FollowupDto {
  return {
    client_id: v.clientId,
    period: v.period,
    status: v.status,
    sent_at: v.sentAt ? v.sentAt.toISOString() : null,
    last_reply_at: v.lastReplyAt ? v.lastReplyAt.toISOString() : null,
    sent_by_user_id: v.sentByUserId,
    internal_notes: v.internalNotes,
  }
}

@ApiTags('Customer Support')
@ApiBearerAuth('bearer')
@Controller('clients/:id/followups')
@Roles('admin')
export class ClientPeriodFollowupsController {
  constructor(private readonly service: ClientPeriodFollowupsService) {}

  @Get()
  @ApiOperation({
    summary: '/v1/clients/:id/followups',
    description: 'Status del cliente en el periodo. Si no existe, retorna default `pending`.',
  })
  @ApiResponse({ status: 200, type: FollowupDto })
  async get(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Query(new ZodValidationPipe(FollowupQuerySchema)) query: FollowupQueryDto,
  ): Promise<FollowupDto> {
    const result = await this.service.getOrInit(clientId, query.period)
    return serialize(result)
  }

  @Patch()
  @ApiOperation({
    summary: '/v1/clients/:id/followups',
    description: 'Actualiza status / sentAt / lastReplyAt / sentByUserId / internalNotes. UPSERT.',
  })
  @ApiResponse({ status: 200, type: FollowupDto })
  async update(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Query(new ZodValidationPipe(FollowupQuerySchema)) query: FollowupQueryDto,
    @Body(new ZodValidationPipe(UpdateFollowupSchema)) dto: UpdateFollowupDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<FollowupDto> {
    const input = {
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.sentAt !== undefined ? { sentAt: dto.sentAt ? new Date(dto.sentAt) : null } : {}),
      ...(dto.lastReplyAt !== undefined
        ? { lastReplyAt: dto.lastReplyAt ? new Date(dto.lastReplyAt) : null }
        : {}),
      ...(dto.sentByUserId !== undefined ? { sentByUserId: dto.sentByUserId } : {}),
      ...(dto.internalNotes !== undefined ? { internalNotes: dto.internalNotes } : {}),
    }
    const result = await this.service.update(clientId, query.period, input, actor.userId)
    return serialize(result)
  }
}
