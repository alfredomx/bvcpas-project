import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { Public } from '../../../../common/decorators/public.decorator'
import { CurrentUser } from '../../../../core/auth/decorators/current-user.decorator'
import type { SessionContext } from '../../../../core/auth/sessions.service'
import {
  MicrosoftAuthorizeResponseDto,
  MicrosoftCallbackQueryDto,
  MicrosoftConnectDto,
} from './dto/microsoft.dto'
import { MicrosoftConnectionService } from './microsoft.service'

@ApiTags('Connections - Microsoft')
@Controller('connections/microsoft')
export class MicrosoftConnectionController {
  constructor(private readonly oauth: MicrosoftConnectionService) {}

  @Post('connect')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'POST /v1/connections/microsoft/connect',
    description:
      'Devuelve URL de consent de Microsoft. El frontend la abre en pestaña/popup; al aprobar, el callback persiste la conexión.',
  })
  @ApiResponse({ status: 200, type: MicrosoftAuthorizeResponseDto })
  async connect(
    @CurrentUser() user: SessionContext,
    @Body() body: MicrosoftConnectDto,
  ): Promise<MicrosoftAuthorizeResponseDto> {
    const url = await this.oauth.buildAuthorizationUrl(user.userId, body.label)
    return { authorizationUrl: url }
  }

  @Public()
  @Get('callback')
  @ApiOperation({
    summary: 'GET /v1/connections/microsoft/callback',
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
${result.label ? `<p><strong>Etiqueta:</strong> ${escapeHtml(result.label)}</p>` : ''}
<p>Ya puedes cerrar esta pestaña.</p>
</div></body></html>`)
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
