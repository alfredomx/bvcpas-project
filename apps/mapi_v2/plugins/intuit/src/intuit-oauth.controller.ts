import { Body, Controller, Get, Header, Post, Query } from '@nestjs/common'
import { Public } from '@/common/auth/public.decorator'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { IntuitOauthService } from './intuit-oauth.service'
import { IntuitStateInvalidError } from './intuit.errors'
import { connectDtoSchema, type ConnectDto } from './dto/intuit.dto'

/**
 * OAuth de Intuit. `connect` (admin) arma la URL; `callback` (público, lo
 * llama Intuit) intercambia el code y guarda los tokens.
 */
@Controller('intuit/oauth')
export class IntuitOauthController {
  constructor(private readonly oauth: IntuitOauthService) {}

  @Post('connect')
  connect(
    @Body(new ZodValidationPipe(connectDtoSchema)) body: ConnectDto,
  ): Promise<{ authorizeUrl: string }> {
    return this.oauth.connect(body.clientId)
  }

  @Public()
  @Get('callback')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async callback(
    @Query('code') code: string,
    @Query('realmId') realmId: string,
    @Query('state') state: string,
  ): Promise<string> {
    if (!code || !realmId || !state) throw new IntuitStateInvalidError()
    const result = await this.oauth.callback(code, realmId, state)
    return `<!doctype html><meta charset="utf-8"><h2>QuickBooks conectado</h2><p>Cliente <code>${result.clientId}</code> · Realm <code>${result.realmId}</code>. Ya puedes cerrar esta pestaña.</p>`
  }
}
