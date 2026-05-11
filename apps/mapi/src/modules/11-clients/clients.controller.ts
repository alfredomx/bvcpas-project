import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import type { Client } from '../../db/schema/clients'
import { ClientAccessRepository } from './client-access.repository'
import { ClientsService } from './clients.service'
import {
  ChangeStatusDto,
  ChangeStatusSchema,
  ClientDto,
  ClientsListResponseDto,
  ListClientsQueryDto,
  ListClientsQuerySchema,
  UpdateClientDto,
  UpdateClientSchema,
} from './dto/clients.dto'

function serialize(c: Client): ClientDto {
  return {
    id: c.id,
    legal_name: c.legalName,
    dba: c.dba,
    qbo_realm_id: c.qboRealmId,
    industry: c.industry,
    entity_type: c.entityType,
    fiscal_year_start: c.fiscalYearStart,
    timezone: c.timezone,
    status: c.status,
    tier: c.tier,
    draft_email_enabled: c.draftEmailEnabled,
    transactions_filter: c.transactionsFilter,
    cc_email: c.ccEmail,
    primary_contact_name: c.primaryContactName,
    primary_contact_email: c.primaryContactEmail,
    notes: c.notes,
    metadata: c.metadata as Record<string, unknown> | null,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  }
}

@ApiTags('Clients - Clients')
@ApiBearerAuth('bearer')
@Controller('clients')
@Roles('admin')
@UseGuards(ClientAccessGuard)
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly accessRepo: ClientAccessRepository,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'GET /v1/clients',
    description:
      'Listado paginado de clientes. Filtros opcionales: `status`, `tier`, `search`. Solo devuelve clientes a los que el usuario tiene acceso (user_client_access).',
  })
  @ApiResponse({ status: 200, type: ClientsListResponseDto })
  async list(
    @Query(new ZodValidationPipe(ListClientsQuerySchema)) query: ListClientsQueryDto,
    @CurrentUser() user: SessionContext,
  ): Promise<ClientsListResponseDto> {
    const allowedClientIds = await this.accessRepo.listClientIdsForUser(user.userId)
    const result = await this.clients.list({
      page: query.page,
      pageSize: query.pageSize,
      allowedClientIds,
      ...(query.status ? { status: query.status } : {}),
      ...(query.tier ? { tier: query.tier } : {}),
      ...(query.search ? { search: query.search } : {}),
    })
    return {
      items: result.items.map(serialize),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'GET /v1/clients/:id',
    description: 'Detalle completo de un cliente. Incluye metadata expandida (intuit_*).',
  })
  @ApiResponse({ status: 200, type: ClientDto })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado o sin acceso' })
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<ClientDto> {
    const client = await this.clients.getById(id)
    return serialize(client)
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'PATCH /v1/clients/:id',
    description:
      'Edita campos operativos. NO acepta `id`, `qbo_realm_id`, `status` (este último vía /status). Emite `client.updated` en event_log con la lista de campos cambiados.',
  })
  @ApiResponse({ status: 200, type: ClientDto })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado o sin acceso' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateClientSchema)) dto: UpdateClientDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<ClientDto> {
    const client = await this.clients.update(id, dto, actor.userId)
    return serialize(client)
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'POST /v1/clients/:id/status',
    description:
      'Cambia el status del cliente. Idempotente: si el nuevo status es el actual, no hace nada. Emite `client.status_changed` en event_log.',
  })
  @ApiResponse({ status: 200, type: ClientDto })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado o sin acceso' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ChangeStatusSchema)) dto: ChangeStatusDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<ClientDto> {
    const client = await this.clients.changeStatus(id, dto.status, actor.userId)
    return serialize(client)
  }
}
