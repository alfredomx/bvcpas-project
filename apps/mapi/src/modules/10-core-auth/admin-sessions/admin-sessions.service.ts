import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../../core/db/db.module'
import { userSessions } from '../../../db/schema/user-sessions'
import { SessionsService } from '../../../core/auth/sessions.service'
import { EventLogService } from '../../95-event-log/event-log.service'
import { SessionNotFoundError } from '../errors'

/**
 * Service para gestión admin de sesiones individuales (revoke específica).
 *
 * Para revoke-all del user usar AdminUsersService (vive más cercano al
 * dominio user).
 */
@Injectable()
export class AdminSessionsService {
  constructor(
    @Inject(DB) private readonly db: DrizzleDb,
    private readonly sessions: SessionsService,
    private readonly events: EventLogService,
  ) {}

  /**
   * Revoca una sesión específica por su id.
   * Lanza SessionNotFoundError si no existe.
   */
  async revoke(sessionId: string, actorUserId: string): Promise<void> {
    const rows = await this.db
      .select()
      .from(userSessions)
      .where(eq(userSessions.id, sessionId))
      .limit(1)

    const session = rows[0]
    if (!session) {
      throw new SessionNotFoundError(`Session ${sessionId} no existe`, { sessionId })
    }

    await this.sessions.revoke(session.jti)

    await this.events.log(
      'auth.session.revoked_by_admin',
      {
        sessionId,
        userId: session.userId,
        revokedByUserId: actorUserId,
      },
      actorUserId,
      { type: 'user_session', id: sessionId },
    )
  }
}
