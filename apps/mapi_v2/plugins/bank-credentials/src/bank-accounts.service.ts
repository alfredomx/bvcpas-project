import { Injectable } from '@nestjs/common'
import { BankAccountsRepository } from './bank-accounts.repository'
import { BankCredentialsRepository } from './bank-credentials.repository'
import {
  BankAccountMaskConflictError,
  BankAccountNotFoundError,
  BankCredentialNotFoundError,
} from './bank-credentials.errors'
import type {
  BankAccount,
  BankAccountStatus,
  BankAccountType,
  NewBankAccount,
} from './bank-accounts.schema'

export interface CreateAccountInput {
  bankCredentialId: string
  accountMask: string
  accountType: BankAccountType
  label?: string | null
  status?: BankAccountStatus
  notes?: string | null
}

export interface UpdateAccountInput {
  accountType?: BankAccountType
  label?: string | null
  status?: BankAccountStatus
  notes?: string | null
}

/** Cuentas individuales (mask/tipo) dentro de un login. */
@Injectable()
export class BankAccountsService {
  constructor(
    private readonly repo: BankAccountsRepository,
    private readonly credentials: BankCredentialsRepository,
  ) {}

  async listByCredential(credentialId: string): Promise<BankAccount[]> {
    await this.assertCredentialExists(credentialId)
    return this.repo.listByCredential(credentialId)
  }

  async getById(id: string): Promise<BankAccount> {
    const row = await this.repo.findById(id)
    if (!row) throw new BankAccountNotFoundError(id)
    return row
  }

  async create(input: CreateAccountInput): Promise<BankAccount> {
    await this.assertCredentialExists(input.bankCredentialId)
    const dup = await this.repo.findByCredentialAndMask(input.bankCredentialId, input.accountMask)
    if (dup) throw new BankAccountMaskConflictError(input.accountMask)

    return this.repo.create({
      bankCredentialId: input.bankCredentialId,
      accountMask: input.accountMask,
      accountType: input.accountType,
      label: input.label ?? null,
      status: input.status ?? 'active',
      notes: input.notes ?? null,
    })
  }

  async update(id: string, input: UpdateAccountInput): Promise<BankAccount> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new BankAccountNotFoundError(id)

    const patch: Partial<NewBankAccount> = {}
    if (input.accountType !== undefined) patch.accountType = input.accountType
    if (input.label !== undefined) patch.label = input.label
    if (input.status !== undefined) patch.status = input.status
    if (input.notes !== undefined) patch.notes = input.notes

    const row = await this.repo.update(id, patch)
    if (!row) throw new BankAccountNotFoundError(id)
    return row
  }

  async delete(id: string): Promise<void> {
    const ok = await this.repo.delete(id)
    if (!ok) throw new BankAccountNotFoundError(id)
  }

  private async assertCredentialExists(credentialId: string): Promise<void> {
    const cred = await this.credentials.findById(credentialId)
    if (!cred) throw new BankCredentialNotFoundError(credentialId)
  }
}
