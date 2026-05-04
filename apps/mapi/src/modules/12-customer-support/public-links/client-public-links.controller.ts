import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import type { ClientPublicLink } from '../../../db/schema/client-public-links'
import {
  ClientIdQueryDto,
  ClientIdQuerySchema,
  CreatePublicLinkDto,
  CreatePublicLinkSchema,
  PublicLinkDto,
  PublicLinksListDto,
} from '../dto/customer-support.dto'
import { ClientPublicLinksService } from './client-public-links.service'

function serialize(l: ClientPublicLink): PublicLinkDto {
  return {
    id: l.id,
    client_id: l.clientId,
    token: l.token,
    purpose: l.purpose,
    expires_at: l.expiresAt ? l.expiresAt.toISOString() : null,
    revoked_at: l.revokedAt ? l.revokedAt.toISOString() : null,
    max_uses: l.maxUses,
    use_count: l.useCount,
    last_used_at: l.lastUsedAt ? l.lastUsedAt.toISOString() : null,
    metadata: l.metadata as Record<string, unknown> | null,
    created_at: l.createdAt.toISOString(),
    created_by_user_id: l.createdByUserId,
  }
}

@ApiTags('Public')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('public/links')
export class ClientPublicLinksController {
  constructor(private readonly service: ClientPublicLinksService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '/v1/public/links',
    description:
      'Crea (o devuelve, idempotente) un link público para un cliente. Pasa `force: true` para revocar el activo y crear uno nuevo. Body: `{clientId, purpose, expiresAt?, maxUses?, metadata?, force?}`.',
  })
  @ApiResponse({ status: 200, type: PublicLinkDto })
  async createOrGet(
    @Body(new ZodValidationPipe(CreatePublicLinkSchema)) dto: CreatePublicLinkDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<PublicLinkDto> {
    const link = await this.service.createOrGet(dto.clientId, dto.purpose, actor.userId, {
      ...(dto.expiresAt !== undefined
        ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
        : {}),
      ...(dto.maxUses !== undefined ? { maxUses: dto.maxUses } : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
      ...(dto.force !== undefined ? { force: dto.force } : {}),
    })
    return serialize(link)
  }

  @Get()
  @ApiOperation({
    summary: '/v1/public/links',
    description:
      'Lista todos los links de un cliente (activos y revocados). Requiere `?clientId=`.',
  })
  @ApiResponse({ status: 200, type: PublicLinksListDto })
  async list(
    @Query(new ZodValidationPipe(ClientIdQuerySchema)) query: ClientIdQueryDto,
  ): Promise<PublicLinksListDto> {
    const items = await this.service.listByClient(query.clientId)
    return { items: items.map(serialize) }
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '/v1/public/links/:id/revoke',
    description: 'Revoca el link inmediatamente. El cliente que lo use recibe 410.',
  })
  @ApiResponse({ status: 204, description: 'Link revocado' })
  async revoke(
    @Param('id', ParseUUIDPipe) linkId: string,
    @CurrentUser() actor: SessionContext,
  ): Promise<void> {
    await this.service.revoke(linkId, actor.userId)
  }
}
