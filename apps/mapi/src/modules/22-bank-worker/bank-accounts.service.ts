import { Injectable } from '@nestjs/common'
import { BankAccountsRepository } from './bank-accounts.repository'
import { EventLogService } from '../95-event-log/event-log.service'
import { BankAccountMaskConflictError, BankAccountNotFoundError } from './bank-worker.errors'
import type { BankAccount, NewBankAccount } from '../../db/schema/bank-accounts'
import type {
  BankAccountResponse,
  ChangeBankAccountStatusDto,
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from './dto/bank-worker.dto'

@Injectable()
export class BankAccountsService {
  constructor(
    private readonly repo: BankAccountsRepository,
    private readonly events: EventLogService,
  ) {}

  async listByCredential(credentialId: string): Promise<BankAccountResponse[]> {
    const rows = await this.repo.listByCredential(credentialId)
    return rows.map((r) => this.toResponse(r))
  }

  async create(
    credentialId: string,
    dto: CreateBankAccountDto,
    userId: string,
  ): Promise<BankAccountResponse> {
    // Verifica que la credencial existe (sin filtrar por client porque este endpoint
    // no recibe clientId — el credentialId ya es único globalmente).
    const dup = await this.repo.findByCredentialAndMask(credentialId, dto.accountMask)
    if (dup) throw new BankAccountMaskConflictError(dto.accountMask)

    const row = await this.repo.create({
      clientBankAccountId: credentialId,
      accountMask: dto.accountMask,
      accountType: dto.accountType,
      label: dto.label ?? null,
      status: dto.status ?? 'active',
      notes: dto.notes ?? null,
    })

    await this.events.log(
      'bank_account.created',
      {
        bank_account_id: row.id,
        client_bank_account_id: credentialId,
        account_mask: row.accountMask,
        account_type: row.accountType,
      },
      userId,
      { type: 'bank_account', id: row.id },
    )

    return this.toResponse(row)
  }

  async update(
    id: string,
    dto: UpdateBankAccountDto,
    userId: string,
  ): Promise<BankAccountResponse> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new BankAccountNotFoundError(id)

    if (dto.accountMask !== undefined && dto.accountMask !== existing.accountMask) {
      const dup = await this.repo.findByCredentialAndMask(
        existing.clientBankAccountId,
        dto.accountMask,
      )
      if (dup) throw new BankAccountMaskConflictError(dto.accountMask)
    }

    const patch: Partial<NewBankAccount> = {}
    if (dto.accountMask !== undefined) patch.accountMask = dto.accountMask
    if (dto.accountType !== undefined) patch.accountType = dto.accountType
    if (dto.label !== undefined) patch.label = dto.label
    if (dto.status !== undefined) patch.status = dto.status
    if (dto.notes !== undefined) patch.notes = dto.notes

    const row = await this.repo.update(id, patch)
    if (!row) throw new BankAccountNotFoundError(id)

    await this.events.log('bank_account.updated', { bank_account_id: id }, userId, {
      type: 'bank_account',
      id,
    })

    return this.toResponse(row)
  }

  async changeStatus(
    id: string,
    dto: ChangeBankAccountStatusDto,
    userId: string,
  ): Promise<BankAccountResponse> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new BankAccountNotFoundError(id)

    if (existing.status === dto.status) {
      return this.toResponse(existing)
    }

    const row = await this.repo.update(id, { status: dto.status })
    if (!row) throw new BankAccountNotFoundError(id)

    await this.events.log(
      'bank_account.status_changed',
      {
        bank_account_id: id,
        from_status: existing.status,
        to_status: dto.status,
        reason: dto.reason ?? null,
      },
      userId,
      { type: 'bank_account', id },
    )

    return this.toResponse(row)
  }

  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.repo.findById(id)
    if (!existing) throw new BankAccountNotFoundError(id)
    const ok = await this.repo.delete(id)
    if (!ok) throw new BankAccountNotFoundError(id)
    await this.events.log(
      'bank_account.deleted',
      { bank_account_id: id, account_mask: existing.accountMask },
      userId,
      { type: 'bank_account', id },
    )
  }

  private toResponse(row: BankAccount): BankAccountResponse {
    return {
      id: row.id,
      client_bank_account_id: row.clientBankAccountId,
      account_mask: row.accountMask,
      account_type: row.accountType,
      label: row.label,
      status: row.status,
      notes: row.notes,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }
  }
}
