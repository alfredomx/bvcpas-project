import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../../core/db/db.module'
import {
  type ClientPeriodFollowup,
  type NewClientPeriodFollowup,
  clientPeriodFollowups,
} from '../../../db/schema/client-period-followups'

@Injectable()
export class ClientPeriodFollowupsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async findByClientAndPeriod(
    clientId: string,
    period: string,
  ): Promise<ClientPeriodFollowup | null> {
    const [row] = await this.db
      .select()
      .from(clientPeriodFollowups)
      .where(
        and(eq(clientPeriodFollowups.clientId, clientId), eq(clientPeriodFollowups.period, period)),
      )
      .limit(1)
    return row ?? null
  }

  async upsert(data: NewClientPeriodFollowup): Promise<ClientPeriodFollowup> {
    const [row] = await this.db
      .insert(clientPeriodFollowups)
      .values(data)
      .onConflictDoUpdate({
        target: [clientPeriodFollowups.clientId, clientPeriodFollowups.period],
        set: {
          status: data.status,
          sentAt: data.sentAt ?? null,
          lastReplyAt: data.lastReplyAt ?? null,
          sentByUserId: data.sentByUserId ?? null,
          internalNotes: data.internalNotes ?? null,
          updatedAt: new Date(),
        },
      })
      .returning()
    if (!row) throw new Error('upsert: no row returned')
    return row
  }
}
