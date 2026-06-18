import { Injectable } from '@nestjs/common'
import { BankPortalsRepository } from './bank-portals.repository'
import { BankPortalNameConflictError, BankPortalNotFoundError } from './bank-credentials.errors'
import type { BankPortal } from './bank-portals.schema'

export interface CreatePortalInput {
  name: string
  portalUrl?: string | null
}

/** Catálogo global de portales bancarios. */
@Injectable()
export class BankPortalsService {
  constructor(private readonly repo: BankPortalsRepository) {}

  async list(): Promise<BankPortal[]> {
    return this.repo.list()
  }

  async getById(id: string): Promise<BankPortal> {
    const row = await this.repo.findById(id)
    if (!row) throw new BankPortalNotFoundError(id)
    return row
  }

  async create(input: CreatePortalInput): Promise<BankPortal> {
    const existing = await this.repo.findByName(input.name)
    if (existing) throw new BankPortalNameConflictError(input.name)
    return this.repo.create({ name: input.name, portalUrl: input.portalUrl ?? null })
  }
}
