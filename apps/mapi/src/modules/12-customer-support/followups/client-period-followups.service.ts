import { Injectable } from '@nestjs/common'
import { EventLogService } from '../../95-event-log/event-log.service'
import type {
  ClientPeriodFollowup,
  FollowupStatus,
} from '../../../db/schema/client-period-followups'
import { ClientPeriodFollowupsRepository } from './client-period-followups.repository'

export interface FollowupView {
  clientId: string
  period: string
  status: FollowupStatus
  sentAt: Date | null
  lastReplyAt: Date | null
  sentByUserId: string | null
  internalNotes: string | null
}

export interface UpdateFollowupInput {
  status?: FollowupStatus
  sentAt?: Date | null
  lastReplyAt?: Date | null
  sentByUserId?: string | null
  internalNotes?: string | null
}

/**
 * Service del status mensual del cliente (Customer Support tab).
 *
 * `getOrInit` retorna el row si existe, o un default `pending` sin escribir
 * (el dashboard puede preguntar por períodos sin escribir basura en DB).
 *
 * `update` hace UPSERT y emite evento si cambia el status.
 */
@Injectable()
export class ClientPeriodFollowupsService {
  constructor(
    private readonly repo: ClientPeriodFollowupsRepository,
    private readonly events: EventLogService,
  ) {}

  async getOrInit(clientId: string, period: string): Promise<FollowupView> {
    const row = await this.repo.findByClientAndPeriod(clientId, period)
    if (row) return toView(row)
    return {
      clientId,
      period,
      status: 'pending',
      sentAt: null,
      lastReplyAt: null,
      sentByUserId: null,
      internalNotes: null,
    }
  }

  async update(
    clientId: string,
    period: string,
    input: UpdateFollowupInput,
    actorUserId: string,
  ): Promise<FollowupView> {
    const before = await this.repo.findByClientAndPeriod(clientId, period)
    const beforeStatus: FollowupStatus = before?.status ?? 'pending'

    const merged: FollowupStatus = input.status ?? beforeStatus
    const upserted = await this.repo.upsert({
      clientId,
      period,
      status: merged,
      sentAt: input.sentAt !== undefined ? input.sentAt : (before?.sentAt ?? null),
      lastReplyAt:
        input.lastReplyAt !== undefined ? input.lastReplyAt : (before?.lastReplyAt ?? null),
      sentByUserId:
        input.sentByUserId !== undefined ? input.sentByUserId : (before?.sentByUserId ?? null),
      internalNotes:
        input.internalNotes !== undefined ? input.internalNotes : (before?.internalNotes ?? null),
    })

    if (merged !== beforeStatus) {
      await this.events.log(
        'client_followup.status_changed',
        { clientId, period, fromStatus: beforeStatus, toStatus: merged },
        actorUserId,
        { type: 'client', id: clientId },
      )
    }

    return toView(upserted)
  }
}

function toView(row: ClientPeriodFollowup): FollowupView {
  return {
    clientId: row.clientId,
    period: row.period,
    status: row.status,
    sentAt: row.sentAt,
    lastReplyAt: row.lastReplyAt,
    sentByUserId: row.sentByUserId,
    internalNotes: row.internalNotes,
  }
}
