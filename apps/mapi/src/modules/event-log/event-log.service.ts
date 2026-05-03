import { Inject, Injectable, Logger } from '@nestjs/common'
import { DB, type DrizzleDb } from '../../core/db/db.module'
import { eventLog } from '../../db/schema/event-log'

/**
 * Servicio para escribir auditoría estructurada en `event_log`.
 *
 * Heredado de mapi v0.x (D-052): swallow errors. Si la inserción falla
 * (DB caída, constraint), NO propaga al caller. Esto evita que un fallo
 * de auditoría rompa la operación principal (ej. login que sí completó
 * pero no se loggeó).
 *
 * Si la inserción falla, el error se registra en logs de pino con nivel
 * `warn` para que sea visible sin afectar el flujo.
 */
@Injectable()
export class EventLogService {
  private readonly logger = new Logger(EventLogService.name)

  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async log(
    eventType: string,
    payload: Record<string, unknown> = {},
    actorUserId?: string,
    resource?: { type: string; id: string },
  ): Promise<void> {
    try {
      await this.db.insert(eventLog).values({
        eventType,
        actorUserId: actorUserId ?? null,
        resourceType: resource?.type ?? null,
        resourceId: resource?.id ?? null,
        payload,
      })
    } catch (err: unknown) {
      this.logger.warn(
        `[event_log] Failed to insert event ${eventType}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
}
