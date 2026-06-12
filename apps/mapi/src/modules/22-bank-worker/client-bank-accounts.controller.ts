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
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { ClientAccessGuard } from '../../core/auth/guards/client-access.guard'
import { RequirePermission } from '../../core/permissions/decorators/require-permission.decorator'
import type { SessionContext } from '../../core/auth/sessions.service'
import {
  CreateClientBankAccountDto,
  CreateClientBankAccountSchema,
  UpdateClientBankAccountDto,
  UpdateClientBankAccountSchema,
  type ClientBankAccountResponse,
} from './dto/bank-worker.dto'
import { ClientBankAccountsService } from './client-bank-accounts.service'

@ApiTags('Banking - Credentials')
@ApiBearerAuth('bearer')
@Controller('clients/:id/banking/credentials')
@UseGuards(ClientAccessGuard)
export class ClientBankAccountsController {
  constructor(private readonly service: ClientBankAccountsService) {}

  @Get()
  @RequirePermission('banking.read')
  @ApiOperation({
    summary: 'GET /v1/clients/:id/banking/credentials — lista credenciales del cliente',
  })
  @ApiResponse({ status: 200, description: 'Credenciales (sin valores encriptados).' })
  async list(
    @Param('id', ParseUUIDPipe) clientId: string,
  ): Promise<{ data: ClientBankAccountResponse[] }> {
    const data = await this.service.list(clientId)
    return { data }
  }

  @Get(':credentialId')
  @RequirePermission('banking.read')
  @ApiOperation({ summary: 'GET /v1/clients/:id/banking/credentials/:credentialId — detalle' })
  @ApiResponse({ status: 200, description: 'Credencial.' })
  @ApiResponse({ status: 404, description: 'No existe.' })
  async findOne(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('credentialId', ParseUUIDPipe) credentialId: string,
  ): Promise<ClientBankAccountResponse> {
    return this.service.findById(credentialId, clientId)
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('banking.create')
  @ApiOperation({ summary: 'POST /v1/clients/:id/banking/credentials — crea credencial' })
  @ApiResponse({ status: 201, description: 'Credencial creada.' })
  @ApiResponse({ status: 404, description: 'Portal no existe.' })
  @ApiResponse({ status: 409, description: 'Cliente ya tiene credencial en ese portal.' })
  async create(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Body(new ZodValidationPipe(CreateClientBankAccountSchema)) dto: CreateClientBankAccountDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<ClientBankAccountResponse> {
    return this.service.create(clientId, dto, actor.userId)
  }

  @Patch(':credentialId')
  @RequirePermission('banking.update')
  @ApiOperation({ summary: 'PATCH /v1/clients/:id/banking/credentials/:credentialId — edita' })
  @ApiResponse({ status: 200, description: 'Actualizada.' })
  @ApiResponse({ status: 404, description: 'No existe.' })
  async update(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('credentialId', ParseUUIDPipe) credentialId: string,
    @Body(new ZodValidationPipe(UpdateClientBankAccountSchema)) dto: UpdateClientBankAccountDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<ClientBankAccountResponse> {
    return this.service.update(credentialId, clientId, dto, actor.userId)
  }

  @Delete(':credentialId')
  @HttpCode(204)
  @RequirePermission('banking.delete')
  @ApiOperation({ summary: 'DELETE /v1/clients/:id/banking/credentials/:credentialId — borra' })
  @ApiResponse({ status: 204, description: 'Borrada.' })
  @ApiResponse({ status: 404, description: 'No existe.' })
  async delete(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('credentialId', ParseUUIDPipe) credentialId: string,
    @CurrentUser() actor: SessionContext,
  ): Promise<void> {
    await this.service.delete(credentialId, clientId, actor.userId)
  }
}
