import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { IntuitTokensService } from './intuit-tokens.service'

/**
 * Mantiene vivos los refresh tokens de Intuit. El refresh de Intuit dura ~100
 * días pero se renueva en cada uso: refrescar semanalmente evita que venzan por
 * inactividad. Cada fallo deja la conexión marcada `needs_reauth` (lo hace el
 * service); este cron solo orquesta y loguea.
 *
 * NO corre en el arranque (a propósito): evita rotar todos los tokens en cada
 * restart del watch en dev. Solo en el schedule semanal.
 *
 * Requiere que mapi_v2 sea el ÚNICO dueño de estos tokens (si otro sistema
 * refresca los mismos realms, se invalidan mutuamente).
 */
@Injectable()
export class IntuitTokensRefreshCron {
  private readonly logger = new Logger(IntuitTokensRefreshCron.name)

  constructor(private readonly tokens: IntuitTokensService) {}

  // Lunes 03:00 (semanal). Muy dentro de la ventana de 100 días.
  @Cron('0 3 * * 1')
  async refreshAll(): Promise<void> {
    try {
      const r = await this.tokens.refreshAll()
      this.logger.log(`auto-refresh intuit: ${r.refreshed}/${r.total} ok, ${r.failed} needs_reauth`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.warn(`auto-refresh intuit falló: ${msg}`)
    }
  }
}
