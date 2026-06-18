import { Injectable } from '@nestjs/common'
import { EncryptionService } from '@/core/encryption/encryption.service'
import {
  BankCredentialsRepository,
  type CredentialListFilters,
} from './bank-credentials.repository'
import { BankPortalsRepository } from './bank-portals.repository'
import { BankCredentialNotFoundError, BankPortalNotFoundError } from './bank-credentials.errors'
import type {
  BankCredential,
  BankCredentialStatus,
  NewBankCredential,
} from './bank-credentials.schema'
import type { BankPortal } from './bank-portals.schema'

export interface CreateCredentialInput {
  clientId: string
  bankPortalId: string
  nickname?: string | null
  username?: string | null
  password?: string | null
  securityQa?: string | null
  status?: BankCredentialStatus
  notes?: string | null
}

export interface UpdateCredentialInput {
  nickname?: string | null
  username?: string | null
  password?: string | null
  securityQa?: string | null
  status?: BankCredentialStatus
  notes?: string | null
}

/**
 * Credencial descifrada que se devuelve por API. NUNCA expone los campos
 * `*_encrypted` (D-bank-007: el operador ve el plaintext para entrar al banco).
 */
export interface BankCredentialResponse {
  id: string
  clientId: string
  portal: { id: string; name: string; portalUrl: string | null }
  nickname: string | null
  username: string | null
  password: string | null
  securityQa: string | null
  status: BankCredentialStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

@Injectable()
export class BankCredentialsService {
  constructor(
    private readonly repo: BankCredentialsRepository,
    private readonly portals: BankPortalsRepository,
    private readonly encryption: EncryptionService,
  ) {}

  async list(filters: CredentialListFilters): Promise<BankCredentialResponse[]> {
    const rows = await this.repo.list(filters)
    return rows.map((r) => this.toResponse(r.credential, r.portal))
  }

  async getById(id: string): Promise<BankCredentialResponse> {
    const row = await this.repo.findByIdWithPortal(id)
    if (!row) throw new BankCredentialNotFoundError(id)
    return this.toResponse(row.credential, row.portal)
  }

  async create(input: CreateCredentialInput): Promise<BankCredentialResponse> {
    const portal = await this.portals.findById(input.bankPortalId)
    if (!portal) throw new BankPortalNotFoundError(input.bankPortalId)

    const row = await this.repo.create({
      clientId: input.clientId,
      bankPortalId: input.bankPortalId,
      nickname: input.nickname ?? null,
      usernameEncrypted: this.encryptOrNull(input.username),
      passwordEncrypted: this.encryptOrNull(input.password),
      securityQaEncrypted: this.encryptOrNull(input.securityQa),
      status: input.status ?? 'active',
      notes: input.notes ?? null,
    })
    return this.toResponse(row, portal)
  }

  async update(id: string, input: UpdateCredentialInput): Promise<BankCredentialResponse> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new BankCredentialNotFoundError(id)

    const patch: Partial<NewBankCredential> = {}
    if (input.nickname !== undefined) patch.nickname = input.nickname
    if (input.username !== undefined) patch.usernameEncrypted = this.encryptOrNull(input.username)
    if (input.password !== undefined) patch.passwordEncrypted = this.encryptOrNull(input.password)
    if (input.securityQa !== undefined)
      patch.securityQaEncrypted = this.encryptOrNull(input.securityQa)
    if (input.status !== undefined) patch.status = input.status
    if (input.notes !== undefined) patch.notes = input.notes

    await this.repo.update(id, patch)
    const withPortal = await this.repo.findByIdWithPortal(id)
    if (!withPortal) throw new BankCredentialNotFoundError(id)
    return this.toResponse(withPortal.credential, withPortal.portal)
  }

  async delete(id: string): Promise<void> {
    const ok = await this.repo.delete(id)
    if (!ok) throw new BankCredentialNotFoundError(id)
  }

  private encryptOrNull(value: string | null | undefined): string | null {
    return value ? this.encryption.encrypt(value) : null
  }

  private toResponse(c: BankCredential, p: BankPortal): BankCredentialResponse {
    return {
      id: c.id,
      clientId: c.clientId,
      portal: { id: p.id, name: p.name, portalUrl: p.portalUrl },
      nickname: c.nickname,
      username: c.usernameEncrypted ? this.encryption.decrypt(c.usernameEncrypted) : null,
      password: c.passwordEncrypted ? this.encryption.decrypt(c.passwordEncrypted) : null,
      securityQa: c.securityQaEncrypted ? this.encryption.decrypt(c.securityQaEncrypted) : null,
      status: c.status,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }
  }
}
