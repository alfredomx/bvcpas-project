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
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { RequirePermission } from '../../core/permissions/decorators/require-permission.decorator'
import type { SessionContext } from '../../core/auth/sessions.service'
import {
  BankAccountListResponseDto,
  BankAccountResponseDto,
  ChangeBankAccountStatusDto,
  ChangeBankAccountStatusSchema,
  CreateBankAccountDto,
  CreateBankAccountSchema,
  UpdateBankAccountDto,
  UpdateBankAccountSchema,
  type BankAccountResponse,
} from './dto/bank-worker.dto'
import { BankAccountsService } from './bank-accounts.service'

@ApiTags('Banking - Accounts')
@ApiBearerAuth('bearer')
@Controller('banking')
export class BankAccountsController {
  constructor(private readonly service: BankAccountsService) {}

  @Get('credentials/:credentialId/accounts')
  @RequirePermission('banking.read')
  @ApiOperation({
    summary: 'GET /v1/banking/credentials/:credentialId/accounts — cuentas dentro del login',
  })
  @ApiResponse({ status: 200, description: 'Lista de cuentas.', type: BankAccountListResponseDto })
  async list(
    @Param('credentialId', ParseUUIDPipe) credentialId: string,
  ): Promise<{ data: BankAccountResponse[] }> {
    const data = await this.service.listByCredential(credentialId)
    return { data }
  }

  @Post('credentials/:credentialId/accounts')
  @HttpCode(201)
  @RequirePermission('banking.create')
  @ApiOperation({ summary: 'POST /v1/banking/credentials/:credentialId/accounts — crea cuenta' })
  @ApiResponse({ status: 201, description: 'Cuenta creada.', type: BankAccountResponseDto })
  @ApiResponse({ status: 409, description: 'Mask duplicado en ese login.' })
  async create(
    @Param('credentialId', ParseUUIDPipe) credentialId: string,
    @Body(new ZodValidationPipe(CreateBankAccountSchema)) dto: CreateBankAccountDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<BankAccountResponse> {
    return this.service.create(credentialId, dto, actor.userId)
  }

  @Patch('accounts/:accountId')
  @RequirePermission('banking.update')
  @ApiOperation({ summary: 'PATCH /v1/banking/accounts/:accountId — edita cuenta' })
  @ApiResponse({ status: 200, description: 'Actualizada.', type: BankAccountResponseDto })
  @ApiResponse({ status: 404, description: 'No existe.' })
  async update(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodValidationPipe(UpdateBankAccountSchema)) dto: UpdateBankAccountDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<BankAccountResponse> {
    return this.service.update(accountId, dto, actor.userId)
  }

  @Post('accounts/:accountId/status')
  @RequirePermission('banking.update')
  @ApiOperation({ summary: 'POST /v1/banking/accounts/:accountId/status — cambia status' })
  @ApiResponse({ status: 200, description: 'Status cambiado.', type: BankAccountResponseDto })
  async changeStatus(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodValidationPipe(ChangeBankAccountStatusSchema)) dto: ChangeBankAccountStatusDto,
    @CurrentUser() actor: SessionContext,
  ): Promise<BankAccountResponse> {
    return this.service.changeStatus(accountId, dto, actor.userId)
  }

  @Delete('accounts/:accountId')
  @HttpCode(204)
  @RequirePermission('banking.delete')
  @ApiOperation({ summary: 'DELETE /v1/banking/accounts/:accountId — borra cuenta' })
  @ApiResponse({ status: 204, description: 'Borrada.' })
  @ApiResponse({ status: 404, description: 'No existe.' })
  async delete(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @CurrentUser() actor: SessionContext,
  ): Promise<void> {
    await this.service.delete(accountId, actor.userId)
  }
}
