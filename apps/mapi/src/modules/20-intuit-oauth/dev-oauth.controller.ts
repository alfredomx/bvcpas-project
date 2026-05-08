import { Controller, Get, Inject, NotFoundException, Query, Res } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { eq } from 'drizzle-orm'
import type { Response } from 'express'
import { Public } from '../../common/decorators/public.decorator'
import { AppConfigService } from '../../core/config/config.service'
import { DB, type DrizzleDb } from '../../core/db/db.module'
import { users } from '../../db/schema/users'
import { DropboxConnectionService } from '../21-connections/providers/dropbox/dropbox.service'
import { GoogleConnectionService } from '../21-connections/providers/google/google.service'
import { MicrosoftConnectionService } from '../21-connections/providers/microsoft/microsoft.service'
import { SquareConnectionService } from '../21-connections/providers/square/square.service'
import { IntuitOauthService } from './oauth/intuit-oauth.service'

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  DEV-ONLY shortcuts para abrir OAuth flows en 1 click            ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  Uso: abre la URL en el browser. Sin curl, sin JWT, sin pegar    ║
 * ║  authorizationUrl. El endpoint hardcodea el `userId` del         ║
 * ║  INITIAL_ADMIN_EMAIL del .env y devuelve un 302 redirect al      ║
 * ║  authorize URL del provider.                                     ║
 * ║                                                                   ║
 * ║  Solo se monta si NODE_ENV='local'. En cualquier otro entorno    ║
 * ║  los endpoints devuelven 404.                                    ║
 * ║                                                                   ║
 * ║  TEMPORAL — comentar/borrar antes de subir a prod.               ║
 * ║                                                                   ║
 * ║  Endpoints:                                                       ║
 * ║    GET /v1/_dev/oauth/intuit                                     ║
 * ║    GET /v1/_dev/oauth/intuit?clientId=<uuid>  (reauth target)   ║
 * ║    GET /v1/_dev/oauth/microsoft                                  ║
 * ║    GET /v1/_dev/oauth/dropbox                                    ║
 * ║    GET /v1/_dev/oauth/google                                     ║
 * ║    GET /v1/_dev/oauth/square?clientId=<uuid>                    ║
 * ║                                                                   ║
 * ║  NOTA: Clover NO está aquí porque es api_key manual (no OAuth). ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
@Public()
@ApiExcludeController()
@Controller('_dev/oauth')
export class DevOauthShortcutsController {
  constructor(
    private readonly cfg: AppConfigService,
    @Inject(DB) private readonly db: DrizzleDb,
    private readonly intuit: IntuitOauthService,
    private readonly microsoft: MicrosoftConnectionService,
    private readonly dropbox: DropboxConnectionService,
    private readonly google: GoogleConnectionService,
    private readonly square: SquareConnectionService,
  ) {}

  private assertLocalEnv(): void {
    if (!this.cfg.isLocal) {
      throw new NotFoundException()
    }
  }

  /**
   * Resuelve user_id del INITIAL_ADMIN_EMAIL del .env. Lanza 404 si la
   * env var no está o el user no existe.
   */
  private async resolveAdminUserId(): Promise<string> {
    const email = this.cfg.initialAdminEmail
    if (!email) {
      throw new NotFoundException('INITIAL_ADMIN_EMAIL no configurado en .env')
    }
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1)
    if (!row) {
      throw new NotFoundException(`Admin user con email ${email} no existe en DB`)
    }
    return row.id
  }

  @Get('intuit')
  async intuitConnect(
    @Query('clientId') clientId: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    this.assertLocalEnv()
    const userId = await this.resolveAdminUserId()
    const url = clientId
      ? await this.intuit.getAuthorizationUrl(userId, clientId)
      : await this.intuit.getAuthorizationUrlForNewClient(userId)
    res.redirect(url)
  }

  @Get('microsoft')
  async microsoftConnect(@Res() res: Response): Promise<void> {
    this.assertLocalEnv()
    const userId = await this.resolveAdminUserId()
    const url = await this.microsoft.buildAuthorizationUrl(userId)
    res.redirect(url)
  }

  @Get('dropbox')
  async dropboxConnect(@Res() res: Response): Promise<void> {
    this.assertLocalEnv()
    const userId = await this.resolveAdminUserId()
    const url = await this.dropbox.buildAuthorizationUrl(userId)
    res.redirect(url)
  }

  @Get('google')
  async googleConnect(@Res() res: Response): Promise<void> {
    this.assertLocalEnv()
    const userId = await this.resolveAdminUserId()
    const url = await this.google.buildAuthorizationUrl(userId)
    res.redirect(url)
  }

  @Get('square')
  async squareConnect(
    @Query('clientId') clientId: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    this.assertLocalEnv()
    if (!clientId) {
      throw new NotFoundException('square requiere ?clientId=<uuid>')
    }
    const userId = await this.resolveAdminUserId()
    const url = await this.square.buildAuthorizationUrl(userId, clientId)
    res.redirect(url)
  }
}
