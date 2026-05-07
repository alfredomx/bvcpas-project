import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import { IntuitApiService } from '../api-client/intuit-api.service'
import { IntuitTokensNotFoundError } from '../intuit-oauth.errors'
import { IntuitTokensRepository } from '../tokens/intuit-tokens.repository'
import { IntuitTokensService } from '../tokens/intuit-tokens.service'
import { IntuitCallRequestDto, TokensListResponseDto } from './dto/intuit-admin.dto'

@ApiTags('Intuit')
@ApiBearerAuth('bearer')
@Controller('intuit')
@Roles('admin')
export class IntuitAdminController {
  constructor(
    private readonly api: IntuitApiService,
    private readonly tokensRepo: IntuitTokensRepository,
    private readonly tokensService: IntuitTokensService,
  ) {}

  @Post(':realmId/call')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '/v1/intuit/:realmId/call',
    description:
      'Proxy genérico contra la V3 API de Intuit. Resuelve clientId por realmId, refresca tokens si hace falta, hace la HTTP call y retorna el JSON crudo de Intuit. Body: {method, path, body?}.',
  })
  @ApiResponse({ status: 200, description: 'Respuesta cruda de Intuit' })
  @ApiResponse({ status: 404, description: 'Realm sin tokens registrados' })
  @ApiResponse({ status: 401, description: 'Refresh token expirado, requiere re-autorización' })
  async call(
    @Param('realmId') realmId: string,
    @Body() dto: IntuitCallRequestDto,
    @CurrentUser() user: SessionContext,
  ): Promise<unknown> {
    const tokens = await this.tokensRepo.findByRealmId(realmId)
    if (!tokens) throw new IntuitTokensNotFoundError(realmId)
    return this.api.call({
      clientId: tokens.clientId,
      userId: user.userId,
      method: dto.method,
      path: dto.path,
      body: dto.body,
    })
  }

  @Get('tokens')
  @ApiOperation({
    summary: '/v1/intuit/tokens',
    description:
      'Listado de status de tokens Intuit por cliente. NO incluye access_token ni refresh_token plaintext, solo metadata: expiraciones, últimos refresh, días hasta expiración.',
  })
  @ApiResponse({ status: 200, type: TokensListResponseDto })
  async list(): Promise<TokensListResponseDto> {
    const rows = await this.tokensRepo.listAll()
    const now = Date.now()
    return {
      items: rows.map((t) => ({
        client_id: t.clientId,
        realm_id: t.realmId,
        access_token_expires_at: t.accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: t.refreshTokenExpiresAt.toISOString(),
        last_refreshed_at: t.lastRefreshedAt ? t.lastRefreshedAt.toISOString() : null,
        days_until_refresh_expiry: Math.max(
          0,
          Math.floor((t.refreshTokenExpiresAt.getTime() - now) / (24 * 3600 * 1000)),
        ),
      })),
    }
  }

  @Delete('tokens/:clientId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '/v1/intuit/tokens/:clientId',
    description:
      'Borra los tokens Intuit del cliente. El cliente tendrá que re-autorizar QBO para que vuelva a operar. Cliente sigue existiendo (la fila clients no se toca).',
  })
  @ApiResponse({ status: 204, description: 'Tokens borrados' })
  async delete(
    @Param('clientId') clientId: string,
    @CurrentUser() actor: SessionContext,
  ): Promise<void> {
    await this.tokensService.deleteTokens(clientId, actor.userId)
  }
}
