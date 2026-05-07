import { Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { Public } from '../../../common/decorators/public.decorator'
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator'
import { Roles } from '../../../core/auth/decorators/roles.decorator'
import type { SessionContext } from '../../../core/auth/sessions.service'
import { AuthorizeResponseDto, CallbackQueryDto } from './dto/intuit-oauth.dto'
import { IntuitOauthService } from './intuit-oauth.service'

@ApiTags('OAuth - Intuit')
@Controller('intuit/oauth')
export class IntuitOauthController {
  constructor(private readonly oauth: IntuitOauthService) {}

  @Post('connect')
  @ApiBearerAuth('bearer')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'POST /v1/intuit/oauth/connect',
    description:
      'Genera URL de Intuit para conectar QBO sin cliente existente. Si el realm devuelto en el callback ya pertenece a un cliente, hace silent re-auth; si no, crea cliente nuevo con datos canónicos de Intuit.',
  })
  @ApiResponse({ status: 200, type: AuthorizeResponseDto })
  async connectNew(@CurrentUser() user: SessionContext): Promise<AuthorizeResponseDto> {
    const url = await this.oauth.getAuthorizationUrlForNewClient(user.userId)
    return { authorizationUrl: url }
  }

  @Public()
  @Get('callback')
  @ApiOperation({
    summary: 'GET /v1/intuit/oauth/callback',
    description:
      'Callback de Intuit tras autorización. Es @Public porque Intuit redirige al usuario sin JWT. Devuelve HTML simple con resumen del flow.',
  })
  @ApiResponse({ status: 200, description: 'HTML de confirmación' })
  async callback(
    @Query() query: CallbackQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const fullUrl = `${req.protocol}://${req.get('host') ?? ''}${req.originalUrl}`
    const result = await this.oauth.handleCallback(query.code, query.realmId, query.state, fullUrl)
    res.status(HttpStatus.OK).type('html').send(`<!doctype html>
<html><head><title>Intuit conectado</title>
<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:60px auto;padding:0 24px;color:#222}
.card{border:1px solid #e3e3e3;border-radius:12px;padding:24px;background:#fafafa}
.ok{color:#0a7d3b}</style></head>
<body><div class="card">
<h2 class="ok">QuickBooks conectado</h2>
<p><strong>Cliente:</strong> ${escapeHtml(result.company_name)}</p>
<p><strong>Realm:</strong> <code>${escapeHtml(result.realm_id)}</code></p>
<p><strong>Resultado:</strong> ${result.outcome}</p>
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
