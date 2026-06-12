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
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { RequirePermission } from '../../core/permissions/decorators/require-permission.decorator'
import type { SessionContext } from '../../core/auth/sessions.service'
import {
  CreateGlobalCredentialDto,
  CreateGlobalCredentialSchema,
  ListGlobalCredentialsQueryDto,
  ListGlobalCredentialsQuerySchema,
  UpdateClientBankAccountDto,
  UpdateClientBankAccountSchema,
  type GlobalCredentialResponse,
  type ListGlobalCredentialsResponse,
} from './dto/bank-worker.dto'
import { ClientBankAccountsService } from './client-bank-accounts.service'

/**
 * Endpoints GLOBALES de credenciales bancarias (v0.16.1).
 *
 * Vista pensada para una pantalla única tipo "todas las credenciales del
 * despacho". No filtra por ClientAccessGuard — el usuario con permiso
 * `banking.read` ve todas las credenciales de todos los clientes.
 *
 * Los endpoints existentes bajo `/v1/clients/:id/banking/credentials`
 * siguen funcionando y son los que se usan desde el detalle de cliente.
 */
@ApiTags('Banking - Credentials Global')
@ApiBearerAuth('bearer')
@Controller('banking/credentials')
export class BankCredentialsGlobalController {
  constructor(private readonly service: ClientBankAccountsService) {}

  @Get()
  @RequirePermission('banking.read')
  @ApiOperation({
    summary: 'GET /v1/banking/credentials — lista global de todas las credenciales',
    description:
      'Devuelve todas las credenciales con cliente y portal poblados. Filtros: clientId, portalId, status, search (busca en client.legal_name, portal.name y notes).',
  })
  @ApiResponse({ status: 200, description: 'Lista global de credenciales.' })
  async list(
    @Query(new ZodValidationPipe(ListGlobalCredentialsQuerySchema))
    query: ListGlobalCredentialsQueryDto,
  ): Promise<ListGlobalCredentialsResponse> {
    return this.service.listGlobal({
      clientId: query.clientId,
      portalId: query.portalId,
      status: query.status,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    })
  }

  @Get(':credentialId')
  @RequirePermission('banking.read')
  @ApiOperation({
    summary: 'GET /v1/banking/credentials/:credentialId — detalle global',
  })
  @ApiResponse({ status: 200, description: 'Credencial con joins de cliente y portal.' })
  @ApiResponse({ status: 404, description: 'No existe.' })
  async findOne(
    @Param('credentialId', ParseUUIDPipe) credentialId: string,
  ): Promise<GlobalCredentialResponse> {
    return this.service.findByIdGlobal(credentialId)
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('banking.create')
  @ApiOperation({
    summary: 'POST /v1/banking/credentials — crea credencial pasando clientId en el body',
  })
  @ApiResponse({ status: 201, description: 'Credencial creada.' })
  @ApiResponse({ status: 404, description: 'Portal no existe.' })
  @ApiResponse({ status: 409, description: 'Ya hay credencial para ese cliente en ese portal.' })
  async create(
    @Body(new ZodValidationPipe(CreateGlobalCredentialSchema)) dto: CreateGlobalCredentialDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<GlobalCredentialResponse> {
    return this.service.createGlobal(dto, actor.userId)
  }

  @Patch(':credentialId')
  @RequirePermission('banking.update')
  @ApiOperation({
    summary: 'PATCH /v1/banking/credentials/:credentialId — edita credencial (global)',
  })
  @ApiResponse({ status: 200, description: 'Actualizada.' })
  @ApiResponse({ status: 404, description: 'No existe.' })
  async update(
    @Param('credentialId', ParseUUIDPipe) credentialId: string,
    @Body(new ZodValidationPipe(UpdateClientBankAccountSchema)) dto: UpdateClientBankAccountDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<GlobalCredentialResponse> {
    return this.service.updateGlobal(credentialId, dto, actor.userId)
  }

  @Delete(':credentialId')
  @HttpCode(204)
  @RequirePermission('banking.delete')
  @ApiOperation({
    summary: 'DELETE /v1/banking/credentials/:credentialId — borra credencial (global)',
  })
  @ApiResponse({ status: 204, description: 'Borrada.' })
  @ApiResponse({ status: 404, description: 'No existe.' })
  async delete(
    @Param('credentialId', ParseUUIDPipe) credentialId: string,
    @CurrentUser() actor: SessionContext,
  ): Promise<void> {
    await this.service.deleteGlobal(credentialId, actor.userId)
  }
}
