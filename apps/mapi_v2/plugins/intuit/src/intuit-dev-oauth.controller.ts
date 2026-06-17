import { Controller, Get, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { z } from 'zod'
import { Public } from '@/common/auth/public.decorator'
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe'
import { IntuitOauthService } from './intuit-oauth.service'

const uuidPipe = new ZodValidationPipe(z.string().uuid())

/**
 * Shortcut DEV-ONLY para abrir el OAuth de Intuit en 1 click, sin curl ni pegar
 * la authorize URL:
 *
 *   GET /v1/_dev/oauth/intuit?clientId=<uuid>  → 302 a la URL de Intuit
 *
 * Es `@Public()` (sin token). **Solo se monta fuera de production** (el module
 * lo incluye condicionalmente por `NODE_ENV`); en prod la ruta no existe.
 * Reutiliza el flujo client-first normal (`connect`), así que valida el client
 * y guarda el state igual que el endpoint real.
 */
@Public()
@Controller('_dev/oauth')
export class IntuitDevOauthController {
  constructor(private readonly oauth: IntuitOauthService) {}

  @Get('intuit')
  async intuit(@Query('clientId', uuidPipe) clientId: string, @Res() res: Response): Promise<void> {
    const { authorizeUrl } = await this.oauth.connect(clientId)
    res.redirect(authorizeUrl)
  }
}
