import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { Public } from '../../../common/decorators/public.decorator'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import { GraphMailService } from '../graph/graph-mail.service'
import { MicrosoftTokensService } from '../tokens/microsoft-tokens.service'
import {
  MicrosoftAuthorizeResponseDto,
  MicrosoftCallbackQueryDto,
  MicrosoftMeResponseDto,
  TestEmailDto,
  TestEmailResponseDto,
} from './dto/microsoft-oauth.dto'
import { MicrosoftOauthService } from './microsoft-oauth.service'

const DEFAULT_SUBJECT = 'Test desde mapi'
const DEFAULT_BODY = 'Si recibes este correo, tu integración con Outlook funciona.'

@ApiTags('Microsoft')
@Controller('microsoft-oauth')
export class MicrosoftOauthController {
  constructor(
    private readonly oauth: MicrosoftOauthService,
    private readonly tokens: MicrosoftTokensService,
    private readonly mail: GraphMailService,
  ) {}

  @Post('connect')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'POST /v1/microsoft-oauth/connect',
    description:
      'Genera URL de consent de Microsoft. El frontend abre la URL en pestaña/popup para que el usuario autorice. El callback persiste tokens y muestra HTML de confirmación.',
  })
  @ApiResponse({ status: 200, type: MicrosoftAuthorizeResponseDto })
  async connect(@CurrentUser() user: SessionContext): Promise<MicrosoftAuthorizeResponseDto> {
    const url = await this.oauth.buildAuthorizationUrl(user.userId)
    return { authorizationUrl: url }
  }

  @Public()
  @Get('callback')
  @ApiOperation({
    summary: 'GET /v1/microsoft-oauth/callback',
    description:
      'Callback de Microsoft tras autorización. @Public porque Microsoft redirige sin JWT. Devuelve HTML simple de confirmación.',
  })
  @ApiResponse({ status: 200, description: 'HTML de confirmación' })
  async callback(@Query() query: MicrosoftCallbackQueryDto, @Res() res: Response): Promise<void> {
    const result = await this.oauth.handleCallback(query.code, query.state)
    res.status(HttpStatus.OK).type('html').send(`<!doctype html>
<html><head><title>Outlook conectado</title>
<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:60px auto;padding:0 24px;color:#222}
.card{border:1px solid #e3e3e3;border-radius:12px;padding:24px;background:#fafafa}
.ok{color:#0a7d3b}</style></head>
<body><div class="card">
<h2 class="ok">Outlook conectado</h2>
<p><strong>Cuenta:</strong> ${escapeHtml(result.email)}</p>
<p>Ya puedes cerrar esta pestaña.</p>
</div></body></html>`)
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'GET /v1/microsoft-oauth/me',
    description: 'Estado de conexión Microsoft del usuario actual.',
  })
  @ApiResponse({ status: 200, type: MicrosoftMeResponseDto })
  async me(@CurrentUser() user: SessionContext): Promise<MicrosoftMeResponseDto> {
    const row = await this.tokens.findRowByUserId(user.userId)
    if (!row) return { connected: false }
    return {
      connected: true,
      email: row.email,
      scopes: row.scopes,
      microsoftUserId: row.microsoftUserId,
    }
  }

  @Delete('me')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'DELETE /v1/microsoft-oauth/me',
    description: 'Desconecta la cuenta Microsoft del usuario actual (borra la fila de tokens).',
  })
  @ApiResponse({ status: 204, description: 'Desconectado' })
  async disconnect(@CurrentUser() user: SessionContext): Promise<void> {
    await this.tokens.deleteByUserId(user.userId)
  }

  @Post('test-email')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'POST /v1/microsoft-oauth/test-email',
    description:
      'Envía un correo de prueba al propio email del usuario para validar la integración.',
  })
  @ApiResponse({ status: 200, type: TestEmailResponseDto })
  async testEmail(
    @CurrentUser() user: SessionContext,
    @Body() body: TestEmailDto,
  ): Promise<TestEmailResponseDto> {
    await this.mail.sendMail(user.userId, {
      to: user.email,
      subject: body.subject ?? DEFAULT_SUBJECT,
      body: body.body ?? DEFAULT_BODY,
    })
    return {
      sentTo: user.email,
      sentAt: new Date().toISOString(),
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
