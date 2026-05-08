import {
  Body,
  Controller,
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
import { ConnectionsService, type PublicConnection } from './connections.service'
import { CreateApiKeyConnectionDto, UpdateApiKeyConnectionDto } from './dto/connections-api-key.dto'
import { ConnectionItemDto } from './dto/connections.dto'
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
@ApiBearerAuth('bearer')
@Controller('connections')
export class ConnectionsApiKeyController {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly cloverProvider: CloverApiKeyProvider,
  ) {}

  /**
   * Valida el shape de `credentials` según `provider`. Lanza
   * `CredentialsShapeError` si falta algún campo. Cuando lleguen más
   * providers api_key (Gemini, Veryfi), se agrega su validador aquí.
   */
  private validateCredentials(provider: string, credentials: Record<string, unknown>): void {
    if (provider === 'clover') {
      this.cloverProvider.validateCredentials(credentials)
    }
    // Otros providers api_key: agregar branches aquí en versiones futuras.
  }

  @Post('api-key')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'POST /v1/connections/api-key',
    description:
      'Crea (o reemplaza) una conexión `auth_type=api_key` con credentials estáticas. ' +
      'El shape de `credentials` lo define cada provider concreto (ej. Clover: `{api_token, merchant_id}`).',
  })
  @ApiResponse({ status: 201, type: ConnectionItemDto })
  async create(
    @CurrentUser() user: SessionContext,
    @Body() body: CreateApiKeyConnectionDto,
  ): Promise<ConnectionItemDto> {
    this.validateCredentials(body.provider, body.credentials)
    const connection = await this.connections.upsertApiKey({
      userId: user.userId,
      provider: body.provider,
      externalAccountId: body.externalAccountId,
      clientId: body.clientId ?? null,
      email: null,
      label: body.label ?? null,
      credentials: body.credentials,
    })
    return toJson(connection)
  }

  @Patch(':id/api-key')
  @ApiOperation({
    summary: 'PATCH /v1/connections/:id/api-key',
    description: 'Actualiza solo `credentials` de una conexión api_key. Solo el dueño.',
  })
  @ApiResponse({ status: 200, type: ConnectionItemDto })
  async updateCredentials(
    @CurrentUser() user: SessionContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateApiKeyConnectionDto,
  ): Promise<ConnectionItemDto> {
    // Resolver el provider de la conexión existente para validar shape.
    const existing = await this.connections.getDecryptedApiKeyByIdForUser(id, user.userId)
    this.validateCredentials(existing.provider, body.credentials)

    const connection = await this.connections.updateApiKeyCredentials(
      id,
      user.userId,
      body.credentials,
    )
    return toJson(connection)
  }
}
