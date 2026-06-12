import { Injectable } from '@nestjs/common'
import { BankPortalsRepository } from './bank-portals.repository'
import { EventLogService } from '../95-event-log/event-log.service'
import {
  BankPortalAlreadyExistsError,
  BankPortalInUseError,
  BankPortalNotFoundError,
} from './bank-worker.errors'
import type { BankPortal } from '../../db/schema/bank-portals'
import type {
  BankPortalResponse,
  CreateBankPortalDto,
  UpdateBankPortalDto,
} from './dto/bank-worker.dto'

@Injectable()
export class BankPortalsService {
  constructor(
    private readonly repo: BankPortalsRepository,
    private readonly events: EventLogService,
  ) {}

  async listAll(): Promise<BankPortalResponse[]> {
    const rows = await this.repo.listAll()
    return rows.map((r) => this.toResponse(r))
  }

  async findById(id: string): Promise<BankPortalResponse> {
    const row = await this.repo.findById(id)
    if (!row) throw new BankPortalNotFoundError(id)
    return this.toResponse(row)
  }

  async create(dto: CreateBankPortalDto, userId: string): Promise<BankPortalResponse> {
    const existing = await this.repo.findByName(dto.name)
    if (existing) throw new BankPortalAlreadyExistsError(dto.name)

    const row = await this.repo.create({ name: dto.name, portalUrl: dto.portalUrl })
    await this.events.log(
      'bank_portal.created',
      { bank_portal_id: row.id, name: row.name, portal_url: row.portalUrl },
      userId,
      { type: 'bank_portal', id: row.id },
    )
    return this.toResponse(row)
  }

  async update(id: string, dto: UpdateBankPortalDto, userId: string): Promise<BankPortalResponse> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new BankPortalNotFoundError(id)

    if (dto.name !== undefined && dto.name !== existing.name) {
      const dup = await this.repo.findByName(dto.name)
      if (dup) throw new BankPortalAlreadyExistsError(dto.name)
    }

    const changed: string[] = []
    const patch: Partial<BankPortal> = {}
    if (dto.name !== undefined && dto.name !== existing.name) {
      patch.name = dto.name
      changed.push('name')
    }
    if (dto.portalUrl !== undefined && dto.portalUrl !== existing.portalUrl) {
      patch.portalUrl = dto.portalUrl
      changed.push('portalUrl')
    }

    const row = await this.repo.update(id, patch)
    if (!row) throw new BankPortalNotFoundError(id)

    if (changed.length > 0) {
      await this.events.log(
        'bank_portal.updated',
        { bank_portal_id: id, fields_changed: changed },
        userId,
        { type: 'bank_portal', id },
      )
    }
    return this.toResponse(row)
  }

  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new BankPortalNotFoundError(id)

    const hasCredentials = await this.repo.hasCredentials(id)
    if (hasCredentials) throw new BankPortalInUseError(id)

    const ok = await this.repo.delete(id)
    if (!ok) throw new BankPortalNotFoundError(id)

    await this.events.log(
      'bank_portal.deleted',
      { bank_portal_id: id, name: existing.name },
      userId,
      { type: 'bank_portal', id },
    )
  }

  private toResponse(row: BankPortal): BankPortalResponse {
    return {
      id: row.id,
      name: row.name,
      portal_url: row.portalUrl,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }
  }
}
