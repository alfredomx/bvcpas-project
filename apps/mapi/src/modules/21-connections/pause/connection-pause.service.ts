import { Injectable } from '@nestjs/common'
import { ConnectionsRepository } from '../connections.repository'
import { ConnectionAccessRepository } from '../connection-access.repository'
import { EventLogService } from '../../95-event-log/event-log.service'
import {
  ConnectionAlreadyPausedError,
  ConnectionNotFoundError,
  ConnectionNotPausedError,
} from '../connection.errors'

/**
 * v0.14.0 — pause/resume manual de conexiones.
 *
 * Reglas de permisos (reusa el patrón de connection-shares):
 * - El dueño (`userConnections.userId === actorUserId`) siempre puede pausar/reanudar.
 * - Un usuario shared con `permission='write'` también puede.
 * - Cualquier otro caso lanza `ConnectionNotFoundError` (no leak de existencia).
 *
 * Pause es informativo en v0.14.0 — workers/crons NO la respetan todavía
 * (D-mapi-054). El dashboard de integraciones la reporta como `paused`.
 */
@Injectable()
export class ConnectionPauseService {
  constructor(
    private readonly repo: ConnectionsRepository,
    private readonly accessRepo: ConnectionAccessRepository,
    private readonly events: EventLogService,
  ) {}

  async pause(connectionId: string, actorUserId: string, reason: string | null): Promise<void> {
    const conn = await this.assertWriteAccess(connectionId, actorUserId)
    if (conn.pausedAt !== null) {
      throw new ConnectionAlreadyPausedError(connectionId)
    }
    await this.repo.setPause(connectionId, new Date(), reason)
    await this.events.log(
      'connection.paused',
      { connection_id: connectionId, provider: conn.provider, reason },
      actorUserId,
      { type: 'connection', id: connectionId },
    )
  }

  async resume(connectionId: string, actorUserId: string): Promise<void> {
    const conn = await this.assertWriteAccess(connectionId, actorUserId)
    if (conn.pausedAt === null) {
      throw new ConnectionNotPausedError(connectionId)
    }
    await this.repo.clearPause(connectionId)
    await this.events.log(
      'connection.resumed',
      { connection_id: connectionId, provider: conn.provider },
      actorUserId,
      { type: 'connection', id: connectionId },
    )
  }

  /**
   * Carga la conexión y verifica que el actor sea dueño O tenga share write.
   * Cualquier otro caso → ConnectionNotFoundError (no leak).
   */
  private async assertWriteAccess(connectionId: string, actorUserId: string) {
    const conn = await this.repo.findById(connectionId)
    if (!conn) throw new ConnectionNotFoundError(connectionId)

    if (conn.userId === actorUserId) return conn

    const share = await this.accessRepo.findByConnectionAndUser(connectionId, actorUserId)
    if (share?.permission !== 'write') {
      throw new ConnectionNotFoundError(connectionId)
    }
    return conn
  }
}
