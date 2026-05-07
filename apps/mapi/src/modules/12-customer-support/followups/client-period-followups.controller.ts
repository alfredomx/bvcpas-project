import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import { ClientAccessGuard } from '../../../core/auth/guards/client-access.guard'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import { FollowupDto, UpdateFollowupDto, UpdateFollowupSchema } from '../dto/customer-support.dto'
import { ClientPeriodFollowupsService, type FollowupView } from './client-period-followups.service'

const PeriodParamSchema = z.string().regex(/^\d{4}-\d{2}$/, 'period debe ser YYYY-MM')

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

@ApiTags('Clients')
@ApiBearerAuth('bearer')
@Controller('clients/:id/followups')
@Roles('admin')
@UseGuards(ClientAccessGuard)
export class ClientPeriodFollowupsController {
  constructor(private readonly service: ClientPeriodFollowupsService) {}

  @Get(':period')
  @ApiOperation({
    summary: 'GET /v1/clients/:id/followups/:period',
    description:
      'Status del cliente en un periodo (YYYY-MM). Si no existe row, retorna default `pending`.',
  })
  @ApiResponse({ status: 200, type: FollowupDto })
  async get(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('period', new ZodValidationPipe(PeriodParamSchema)) period: string,
  ): Promise<FollowupDto> {
    const result = await this.service.getOrInit(clientId, period)
    return serialize(result)
  }

  @Patch(':period')
  @ApiOperation({
    summary: 'PATCH /v1/clients/:id/followups/:period',
    description:
      'Actualiza status / sentAt / lastReplyAt / sentByUserId / internalNotes para el cliente y periodo. UPSERT.',
  })
  @ApiResponse({ status: 200, type: FollowupDto })
  async update(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('period', new ZodValidationPipe(PeriodParamSchema)) period: string,
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
    const result = await this.service.update(clientId, period, input, actor.userId)
    return serialize(result)
  }
}
