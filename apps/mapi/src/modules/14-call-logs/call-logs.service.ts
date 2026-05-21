import { Injectable } from '@nestjs/common'
import { CallLogsRepository } from './call-logs.repository'
import { CallLogNotFoundError } from './call-logs.errors'
import { EventLogService } from '../95-event-log/event-log.service'
import type { ClientCallLog } from '../../db/schema/client-call-logs'
import type {
  CallLogResponse,
  CreateCallLogBodyDto,
  ListCallLogsQueryDto,
  ListCallLogsResponse,
  UpdateCallLogBodyDto,
} from './dto/call-logs.dto'

@Injectable()
export class CallLogsService {
  constructor(
    private readonly repo: CallLogsRepository,
    private readonly events: EventLogService,
  ) {}

  async create(
    clientId: string,
    userId: string,
    dto: CreateCallLogBodyDto,
  ): Promise<CallLogResponse> {
    const row = await this.repo.create({
      clientId,
      userId,
      outcome: dto.outcome,
      notes: dto.notes ?? null,
      calledAt: dto.called_at ? new Date(dto.called_at) : undefined,
    })

    await this.events.log(
      'call_log.created',
      { logId: row.id, clientId, outcome: row.outcome },
      userId,
      { type: 'client', id: clientId },
    )

    return this.toResponse(row)
  }

  async list(clientId: string, query: ListCallLogsQueryDto): Promise<ListCallLogsResponse> {
    const rows = await this.repo.listByClient(clientId, {
      limit: query.limit,
      offset: query.offset,
    })
    return {
      items: rows.map((r) => this.toResponse(r)),
      limit: query.limit,
      offset: query.offset,
    }
  }

  async update(
    logId: string,
    clientId: string,
    userId: string,
    dto: UpdateCallLogBodyDto,
  ): Promise<CallLogResponse> {
    const existing = await this.repo.findById(logId, clientId)
    if (!existing) throw new CallLogNotFoundError(logId)

    const patch: Parameters<CallLogsRepository['update']>[2] = {}
    const changes: Record<string, unknown> = {}
    if (dto.outcome !== undefined && dto.outcome !== existing.outcome) {
      patch.outcome = dto.outcome
      changes.outcome = { from: existing.outcome, to: dto.outcome }
    }
    if (dto.notes !== undefined && dto.notes !== existing.notes) {
      patch.notes = dto.notes
      changes.notes = { from: existing.notes, to: dto.notes }
    }
    if (dto.called_at !== undefined) {
      const newDate = new Date(dto.called_at)
      if (newDate.getTime() !== existing.calledAt.getTime()) {
        patch.calledAt = newDate
        changes.calledAt = { from: existing.calledAt.toISOString(), to: newDate.toISOString() }
      }
    }

    const row = await this.repo.update(logId, clientId, patch)
    if (!row) throw new CallLogNotFoundError(logId)

    if (Object.keys(changes).length > 0) {
      await this.events.log('call_log.updated', { logId, clientId, changes }, userId, {
        type: 'client',
        id: clientId,
      })
    }

    return this.toResponse(row)
  }

  async hardDelete(logId: string, clientId: string, userId: string): Promise<void> {
    const ok = await this.repo.hardDelete(logId, clientId)
    if (!ok) throw new CallLogNotFoundError(logId)

    await this.events.log('call_log.deleted', { logId, clientId }, userId, {
      type: 'client',
      id: clientId,
    })
  }

  private toResponse(row: ClientCallLog): CallLogResponse {
    return {
      id: row.id,
      client_id: row.clientId,
      user_id: row.userId,
      called_at: row.calledAt.toISOString(),
      outcome: row.outcome,
      notes: row.notes,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }
  }
}
