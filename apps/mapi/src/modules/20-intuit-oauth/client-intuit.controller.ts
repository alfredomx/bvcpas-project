import { Controller, Delete, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { ClientAccessGuard } from '../../core/auth/guards/client-access.guard'
import { Roles } from '../../core/auth/decorators/roles.decorator'
import type { SessionContext } from '../../core/auth/sessions.service'
import { ClientsRepository } from '../11-clients/clients.repository'
import { ClientNotFoundError } from '../11-clients/clients.errors'
import { ConnectionsRepository } from '../21-connections/connections.repository'
import { EventLogService } from '../95-event-log/event-log.service'
import { AuthorizeResponseDto } from './oauth/dto/intuit-oauth.dto'
import { IntuitOauthService } from './oauth/intuit-oauth.service'

/**
 * Endpoints Intuit que son ACCIONES SOBRE UN CLIENTE específico.
 * Forma C de URLs (D-mapi-019): bajo /v1/clients/:id/...
 *
 * - POST   /v1/clients/:id/intuit/reconnect — re-autoriza con QBO.
 * - DELETE /v1/clients/:id/intuit/connection — borra TODAS las
 *   conexiones Intuit del cliente.
 *
 * Notas:
 * - Reconnect dispara OAuth y persiste el resultado vía
 *   ConnectionsService.upsert (no aquí; aquí solo se delega al
 *   IntuitOauthService).
 * - Disconnect borra todas las rows de user_connections del cliente
 *   con provider='intuit', sin importar qué user las creó.
 */
@ApiTags('Clients - Intuit')
@ApiBearerAuth('bearer')
@Controller('clients/:id/intuit')
@Roles('admin')
@UseGuards(ClientAccessGuard)
export class ClientIntuitController {
  constructor(
    private readonly oauth: IntuitOauthService,
    private readonly clientsRepo: ClientsRepository,
    private readonly connectionsRepo: ConnectionsRepository,
    private readonly events: EventLogService,
  ) {}

  @Post('reconnect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'POST /v1/clients/:id/intuit/reconnect',
    description:
      'Genera URL de Intuit para reconectar QBO a un cliente existente. Pre-asigna el cliente target. El callback valida que el realm devuelto coincida (o asocia uno nuevo si el cliente no tenía).',
  })
  @ApiResponse({ status: 200, type: AuthorizeResponseDto })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async reconnect(
    @Param('id') clientId: string,
    @CurrentUser() user: SessionContext,
  ): Promise<AuthorizeResponseDto> {
    const client = await this.clientsRepo.findById(clientId)
    if (!client) throw new ClientNotFoundError(clientId)
    const url = await this.oauth.getAuthorizationUrl(user.userId, clientId)
    return { authorizationUrl: url }
  }

  @Delete('connection')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'DELETE /v1/clients/:id/intuit/connection',
    description:
      'Borra TODAS las conexiones Intuit del cliente (de cualquier user que las haya creado). El cliente tendrá que re-autorizar QBO. La fila clients no se toca.',
  })
  @ApiResponse({ status: 204, description: 'Conexiones borradas' })
  async disconnect(
    @Param('id') clientId: string,
    @CurrentUser() actor: SessionContext,
  ): Promise<void> {
    // Validar que el cliente exista para devolver 404 explícito en vez
    // de NO_CONTENT silencioso si no hay match.
    const client = await this.clientsRepo.findById(clientId)
    if (!client) throw new ClientNotFoundError(clientId)
    const deleted = await this.connectionsRepo.deleteByClientIdAndProvider(clientId, 'intuit')
    if (deleted > 0) {
      await this.events.log(
        'intuit.tokens.deleted',
        { client_id: clientId, deleted_count: deleted },
        actor.userId,
        { type: 'client', id: clientId },
      )
    }
  }
}
