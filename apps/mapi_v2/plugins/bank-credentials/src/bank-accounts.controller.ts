import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { BankAccountsService } from './bank-accounts.service'
import {
  accountListQuerySchema,
  createAccountSchema,
  updateAccountSchema,
  type AccountListQueryDto,
  type CreateAccountDto,
  type UpdateAccountDto,
} from './dto/bank-credentials.dto'
import type { BankAccount } from './bank-accounts.schema'

const uuidPipe = new ZodValidationPipe(z.string().uuid())
const listPipe = new ZodValidationPipe(accountListQuerySchema)

/**
 * Cuentas individuales dentro de un login. `credentialId` es filtro de query
 * (requerido) en la lista; en el alta va en el body. Bajo el `AdminGuard` global.
 */
@Controller('bank/accounts')
export class BankAccountsController {
  constructor(private readonly accounts: BankAccountsService) {}

  @Get()
  list(@Query(listPipe) q: AccountListQueryDto): Promise<BankAccount[]> {
    return this.accounts.listByCredential(q.credentialId)
  }

  @Get(':id')
  getById(@Param('id', uuidPipe) id: string): Promise<BankAccount> {
    return this.accounts.getById(id)
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createAccountSchema)) dto: CreateAccountDto,
  ): Promise<BankAccount> {
    return this.accounts.create(dto)
  }

  @Patch(':id')
  update(
    @Param('id', uuidPipe) id: string,
    @Body(new ZodValidationPipe(updateAccountSchema)) dto: UpdateAccountDto,
  ): Promise<BankAccount> {
    return this.accounts.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id', uuidPipe) id: string): Promise<void> {
    await this.accounts.delete(id)
  }
}
