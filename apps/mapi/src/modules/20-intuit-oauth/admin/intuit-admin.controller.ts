import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import { ConnectionsRepository } from '../../21-connections/connections.repository'
import { IntuitApiService } from '../api-client/intuit-api.service'
import { IntuitTokensNotFoundError } from '../intuit-oauth.errors'
import { IntuitCallRequestDto, TokensListResponseDto } from './dto/intuit-admin.dto'

const MS_PER_DAY = 24 * 3600 * 1000

/**
 * Endpoints admin de Intuit (no atados a un cliente específico).
 *
 * - POST /v1/intuit/realms/:realmId/call — proxy genérico V3.
 * - GET  /v1/intuit/oauth/tokens — listado de conexiones Intuit (admin).
 *
 * El DELETE de conexión por cliente vivía aquí en v0.7.x; en v0.8.0 se
 * movió a `client-intuit.controller.ts` (Forma C: bajo /v1/clients/:id/...).
 */
@ApiTags('Intuit')
@ApiBearerAuth('bearer')
@Controller('intuit')
@Roles('admin')
export class IntuitAdminController {
  constructor(
    private readonly api: IntuitApiService,
    private readonly connectionsRepo: ConnectionsRepository,
  ) {}

  @Post('realms/:realmId/call')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'POST /v1/intuit/realms/:realmId/call',
    description:
      'Proxy genérico contra la V3 API de Intuit. Resuelve clientId desde el realm via user_connections, refresca tokens si hace falta, hace la HTTP call y retorna el JSON crudo de Intuit. Body: {method, path, body?}.',
  })
  @ApiResponse({ status: 200, description: 'Respuesta cruda de Intuit' })
  @ApiResponse({ status: 404, description: 'Realm sin conexión registrada' })
  @ApiResponse({ status: 401, description: 'Refresh token expirado, requiere re-autorización' })
  async call(
    @Param('realmId') realmId: string,
    @Body() dto: IntuitCallRequestDto,
    @CurrentUser() user: SessionContext,
  ): Promise<unknown> {
    const conn = await this.connectionsRepo.findByProviderAndExternalAccountId('intuit', realmId)
    if (conn?.clientId == null) throw new IntuitTokensNotFoundError(realmId)
    return this.api.call({
      clientId: conn.clientId,
      userId: user.userId,
      method: dto.method,
      path: dto.path,
      body: dto.body,
    })
  }

  @Get('oauth/tokens')
  @ApiOperation({
    summary: 'GET /v1/intuit/oauth/tokens',
    description:
      'Listado de status de conexiones Intuit (admin). NO incluye access_token ni refresh_token plaintext, solo metadata: expiraciones, últimos refresh, días hasta expiración.',
  })
  @ApiResponse({ status: 200, type: TokensListResponseDto })
  async list(): Promise<TokensListResponseDto> {
    const rows = await this.connectionsRepo.listByProvider('intuit')
    const now = Date.now()
    return {
      items: rows
        .filter((r) => r.clientId !== null && r.refreshTokenExpiresAt !== null)
        .map((r) => ({
          client_id: r.clientId!,
          realm_id: r.externalAccountId,
          access_token_expires_at: r.accessTokenExpiresAt.toISOString(),
          refresh_token_expires_at: r.refreshTokenExpiresAt!.toISOString(),
          last_refreshed_at: r.lastRefreshedAt ? r.lastRefreshedAt.toISOString() : null,
          days_until_refresh_expiry: Math.max(
            0,
            Math.floor((r.refreshTokenExpiresAt!.getTime() - now) / MS_PER_DAY),
          ),
        })),
    }
  }
}
