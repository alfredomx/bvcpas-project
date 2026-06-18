import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { BankCredentialsService, type BankCredentialResponse } from './bank-credentials.service'
import {
  createCredentialSchema,
  credentialListQuerySchema,
  updateCredentialSchema,
  type CreateCredentialDto,
  type CredentialListQueryDto,
  type UpdateCredentialDto,
} from './dto/bank-credentials.dto'

const uuidPipe = new ZodValidationPipe(z.string().uuid())
const listPipe = new ZodValidationPipe(credentialListQuerySchema)

/**
 * Credenciales (logins) bancarias. Rutas flat: `clientId` es filtro de query,
 * no va en el path (D-bank-003). La lista global del despacho = `GET` sin
 * filtros; la del cliente = `?clientId=`. Bajo el `AdminGuard` global.
 */
@Controller('bank/credentials')
export class BankCredentialsController {
  constructor(private readonly credentials: BankCredentialsService) {}

  @Get()
  list(@Query(listPipe) q: CredentialListQueryDto): Promise<BankCredentialResponse[]> {
    return this.credentials.list(q)
  }

  @Get(':id')
  getById(@Param('id', uuidPipe) id: string): Promise<BankCredentialResponse> {
    return this.credentials.getById(id)
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createCredentialSchema)) dto: CreateCredentialDto,
  ): Promise<BankCredentialResponse> {
    return this.credentials.create(dto)
  }

  @Patch(':id')
  update(
    @Param('id', uuidPipe) id: string,
    @Body(new ZodValidationPipe(updateCredentialSchema)) dto: UpdateCredentialDto,
  ): Promise<BankCredentialResponse> {
    return this.credentials.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id', uuidPipe) id: string): Promise<void> {
    await this.credentials.delete(id)
  }
}
