import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { IntuitApiService, type MappedCompanyInfo } from './intuit-api.service'
import { IntuitTokensService } from './intuit-tokens.service'
import { IntuitTokensNotFoundError } from './intuit.errors'
import { callDtoSchema, type CallDto } from './dto/intuit.dto'

const uuidSchema = z.string().uuid()

/**
 * Rutas admin de Intuit: proxy V3, company-info (para overwrite), estado de
 * tokens y revocar conexión. Todo bajo el `AdminGuard` global.
 */
@Controller('intuit')
export class IntuitAdminController {
  constructor(
    private readonly api: IntuitApiService,
    private readonly tokens: IntuitTokensService,
  ) {}

  @Post('realms/:realmId/call')
  async call(
    @Param('realmId') realmId: string,
    @Body(new ZodValidationPipe(callDtoSchema)) body: CallDto,
  ): Promise<unknown> {
    const clientId = await this.tokens.getClientIdByRealm(realmId)
    return this.api.call(clientId, body.method, body.path, body.body)
  }

  @Get('clients/:clientId/company-info')
  companyInfo(
    @Param('clientId', new ZodValidationPipe(uuidSchema)) clientId: string,
  ): Promise<MappedCompanyInfo> {
    return this.api.getCompanyInfo(clientId)
  }

  @Get('tokens')
  listTokens(): ReturnType<IntuitTokensService['listStatus']> {
    return this.tokens.listStatus()
  }

  @Delete('tokens/:clientId')
  async deleteTokens(
    @Param('clientId', new ZodValidationPipe(uuidSchema)) clientId: string,
  ): Promise<{ deleted: boolean }> {
    const deleted = await this.tokens.deleteByClientId(clientId)
    if (!deleted) throw new IntuitTokensNotFoundError(clientId)
    return { deleted }
  }
}
