import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import type { SessionContext } from '../../core/auth/sessions.service'
import { ConnectionsRepository } from './connections.repository'
import { ConnectionNotFoundError } from './connection.errors'
import { ConnectionTokenRefreshService } from './connection-token-refresh.service'
import { ConnectionsService, type PublicConnection } from './connections.service'
import {
  ConnectionItemDto,
  ListConnectionsQueryDto,
  ListConnectionsResponseDto,
  TestConnectionResponseDto,
  UpdateLabelDto,
} from './dto/connections.dto'
import { ProviderRegistry } from './provider-registry.service'
import { CloverApiKeyProvider } from './providers/clover/clover-api-key.provider'

function toJson(c: PublicConnection): ConnectionItemDto {
  return {
    id: c.id,
    provider: c.provider,
    externalAccountId: c.externalAccountId,
    authType: c.authType,
    email: c.email,
    label: c.label,
    scopes: c.scopes,
    accessRole: c.accessRole,
    accessTokenExpiresAt: c.accessTokenExpiresAt ? c.accessTokenExpiresAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

@ApiTags('Connections')
@Controller('connections')
export class ConnectionsController {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly refresh: ConnectionTokenRefreshService,
    private readonly registry: ProviderRegistry,
    private readonly repo: ConnectionsRepository,
    private readonly cloverApiKey: CloverApiKeyProvider,
  ) {}

  @Get()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'GET /v1/connections',
    description:
      'Lista todas las conexiones del usuario actual. Filtro opcional por provider. NO devuelve tokens.',
  })
  @ApiResponse({ status: 200, type: ListConnectionsResponseDto })
  async list(
    @CurrentUser() user: SessionContext,
    @Query() query: ListConnectionsQueryDto,
  ): Promise<ListConnectionsResponseDto> {
    const items = await this.connections.listByUser(user.userId, {
      provider: query.provider,
    })
    return { items: items.map(toJson) }
  }

  @Patch(':id')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'PATCH /v1/connections/:id',
    description: 'Actualiza el label de una conexión propia. Único campo editable.',
  })
  @ApiResponse({ status: 200, type: ConnectionItemDto })
  async updateLabel(
    @CurrentUser() user: SessionContext,
    @Param('id') id: string,
    @Body() body: UpdateLabelDto,
  ): Promise<ConnectionItemDto> {
    const updated = await this.connections.updateLabelForUser(id, user.userId, body.label)
    return toJson(updated)
  }

  @Delete(':id')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'DELETE /v1/connections/:id',
    description: 'Desconecta (borra row + tokens). Solo si la conexión es del usuario actual.',
  })
  @ApiResponse({ status: 204, description: 'Borrada' })
  async delete(@CurrentUser() user: SessionContext, @Param('id') id: string): Promise<void> {
    await this.connections.deleteByIdForUser(id, user.userId)
  }

  @Post(':id/test')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'POST /v1/connections/:id/test',
    description:
      'Prueba la conexión. Para OAuth: refresca + delega al provider. Para api_key: descifra credentials + delega al provider api-key correspondiente.',
  })
  @ApiResponse({ status: 200, type: TestConnectionResponseDto })
  async test(
    @CurrentUser() user: SessionContext,
    @Param('id') id: string,
  ): Promise<TestConnectionResponseDto> {
    // Detectar auth_type para ramificar.
    const row = await this.repo.findById(id)
    if (!row) throw new ConnectionNotFoundError(id)

    if (row.authType === 'api_key') {
      const decrypted = await this.connections.getDecryptedApiKeyByIdForUser(id, user.userId)
      if (decrypted.provider === 'clover') {
        return this.cloverApiKey.test(decrypted)
      }
      throw new ConnectionNotFoundError(`api_key provider ${decrypted.provider} sin test impl`)
    }

    // OAuth path: refresca + delega al provider OAuth.
    await this.refresh.getValidAccessToken(id, user.userId)
    const decrypted = await this.connections.getDecryptedByIdForUser(id, user.userId)
    const provider = this.registry.get(decrypted.provider)
    return provider.test(decrypted)
  }
}
