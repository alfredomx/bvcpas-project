import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../../core/db/db.module'
import {
  type ClientCallLog,
  type NewClientCallLog,
  clientCallLogs,
} from '../../db/schema/client-call-logs'

export interface ListCallLogsOptions {
  limit?: number
  offset?: number
}

export interface UpdateCallLogPatch {
  outcome?: ClientCallLog['outcome']
  notes?: string | null
  calledAt?: Date
}

@Injectable()
export class CallLogsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async create(data: NewClientCallLog): Promise<ClientCallLog> {
    const [row] = await this.db.insert(clientCallLogs).values(data).returning()
    if (!row) throw new Error('create: no row returned')
    return row
  }

  async listByClient(
    clientId: string,
    options: ListCallLogsOptions = {},
  ): Promise<ClientCallLog[]> {
    const limit = options.limit ?? 20
    const offset = options.offset ?? 0

    return this.db
      .select()
      .from(clientCallLogs)
      .where(eq(clientCallLogs.clientId, clientId))
      .orderBy(desc(clientCallLogs.calledAt))
      .limit(limit)
      .offset(offset)
  }

  async findById(logId: string, clientId: string): Promise<ClientCallLog | null> {
    const [row] = await this.db
      .select()
      .from(clientCallLogs)
      .where(and(eq(clientCallLogs.id, logId), eq(clientCallLogs.clientId, clientId)))
      .limit(1)
    return row ?? null
  }

  async update(
    logId: string,
    clientId: string,
    patch: UpdateCallLogPatch,
  ): Promise<ClientCallLog | null> {
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (patch.outcome !== undefined) updates.outcome = patch.outcome
    if (patch.notes !== undefined) updates.notes = patch.notes
    if (patch.calledAt !== undefined) updates.calledAt = patch.calledAt

    const [row] = await this.db
      .update(clientCallLogs)
      .set(updates)
      .where(and(eq(clientCallLogs.id, logId), eq(clientCallLogs.clientId, clientId)))
      .returning()
    return row ?? null
  }

  async hardDelete(logId: string, clientId: string): Promise<boolean> {
    const result = await this.db
      .delete(clientCallLogs)
      .where(and(eq(clientCallLogs.id, logId), eq(clientCallLogs.clientId, clientId)))
      .returning({ id: clientCallLogs.id })
    return result.length > 0
  }
}
