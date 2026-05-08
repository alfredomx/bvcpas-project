import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { Public } from '../../../../common/decorators/public.decorator'
import { CurrentUser } from '../../../../core/auth/decorators/current-user.decorator'
import type { SessionContext } from '../../../../core/auth/sessions.service'
import { ConnectionAuthError, ConnectionStateInvalidError } from '../../connection.errors'
import {
  SquareAuthorizeResponseDto,
  SquareCallbackQueryDto,
  SquareConnectDto,
} from './dto/square.dto'
import { SquareConnectionService } from './square.service'

@ApiTags('Merchants - Square')
@Controller('square/oauth')
export class SquareConnectionController {
  constructor(private readonly oauth: SquareConnectionService) {}

  @Post('connect')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'POST /v1/square/oauth/connect',
    description:
      'Genera URL de autorización Square. El frontend la abre en pestaña; el merchant aprueba; Square redirige al callback.',
  })
  @ApiResponse({ status: 200, type: SquareAuthorizeResponseDto })
  async connect(
    @CurrentUser() user: SessionContext,
    @Body() body: SquareConnectDto,
  ): Promise<SquareAuthorizeResponseDto> {
    const url = await this.oauth.buildAuthorizationUrl(user.userId, body.clientId, body.label)
    return { authorizationUrl: url }
  }

  @Public()
  @Get('callback')
  @ApiOperation({
    summary: 'GET /v1/square/oauth/callback',
    description:
      'Callback de Square. @Public porque Square redirige sin JWT. Recibe code + state, o error si el merchant rechazó.',
  })
  @ApiResponse({ status: 200, description: 'HTML de confirmación' })
  async callback(@Query() query: SquareCallbackQueryDto, @Res() res: Response): Promise<void> {
    if (query.error) {
      throw new ConnectionAuthError(
        `Square authorization rechazada: ${query.error} ${query.error_description ?? ''}`,
      )
    }
    if (!query.code) {
      throw new ConnectionStateInvalidError()
    }
    const result = await this.oauth.handleCallback(query.code, query.state)
    res.status(HttpStatus.OK).type('html').send(`<!doctype html>
<html><head><title>Square conectado</title>
<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:60px auto;padding:0 24px;color:#222}
.card{border:1px solid #e3e3e3;border-radius:12px;padding:24px;background:#fafafa}
.ok{color:#0a7d3b}</style></head>
<body><div class="card">
<h2 class="ok">Square conectado</h2>
<p><strong>Merchant:</strong> ${escapeHtml(result.merchantId)}</p>
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
