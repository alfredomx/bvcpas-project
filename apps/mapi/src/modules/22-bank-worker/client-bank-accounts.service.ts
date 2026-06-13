import { Injectable } from '@nestjs/common'
import {
  ClientBankAccountsRepository,
  type GlobalCredentialRow,
  type ListGlobalFilters,
} from './client-bank-accounts.repository'
import { BankPortalsRepository } from './bank-portals.repository'
import { EventLogService } from '../95-event-log/event-log.service'
import { EncryptionService } from '../../core/encryption/encryption.service'
import { BankPortalNotFoundError, ClientBankAccountNotFoundError } from './bank-worker.errors'
import type { ClientBankAccount, NewClientBankAccount } from '../../db/schema/client-bank-accounts'
import type {
  ClientBankAccountResponse,
  CreateClientBankAccountDto,
  CreateGlobalCredentialDto,
  GlobalCredentialResponse,
  ListGlobalCredentialsResponse,
  UpdateClientBankAccountDto,
} from './dto/bank-worker.dto'

@Injectable()
export class ClientBankAccountsService {
  constructor(
    private readonly repo: ClientBankAccountsRepository,
    private readonly portalsRepo: BankPortalsRepository,
    private readonly events: EventLogService,
    private readonly encryption: EncryptionService,
  ) {}

  async list(clientId: string): Promise<ClientBankAccountResponse[]> {
    const rows = await this.repo.listByClient(clientId)
    return rows.map((r) => this.toResponse(r))
  }

  async findById(id: string, clientId: string): Promise<ClientBankAccountResponse> {
    const row = await this.repo.findById(id, clientId)
    if (!row) throw new ClientBankAccountNotFoundError(id)
    return this.toResponse(row)
  }

  async create(
    clientId: string,
    dto: CreateClientBankAccountDto,
    userId: string,
  ): Promise<ClientBankAccountResponse> {
    const portal = await this.portalsRepo.findById(dto.bankPortalId)
    if (!portal) throw new BankPortalNotFoundError(dto.bankPortalId)

    const row = await this.repo.create({
      clientId,
      bankPortalId: dto.bankPortalId,
      nickname: dto.nickname ?? null,
      usernameEncrypted: this.encryption.encrypt(dto.username),
      passwordEncrypted: this.encryption.encrypt(dto.password),
      securityQaEncrypted: dto.securityQa ? this.encryption.encrypt(dto.securityQa) : null,
      status: dto.status ?? 'active',
      notes: dto.notes ?? null,
    })

    await this.events.log(
      'client_bank_account.created',
      {
        client_bank_account_id: row.id,
        client_id: clientId,
        bank_portal_id: row.bankPortalId,
        status: row.status,
      },
      userId,
      { type: 'client_bank_account', id: row.id },
    )

    return this.toResponse(row)
  }

  async update(
    id: string,
    clientId: string,
    dto: UpdateClientBankAccountDto,
    userId: string,
  ): Promise<ClientBankAccountResponse> {
    const existing = await this.repo.findById(id, clientId)
    if (!existing) throw new ClientBankAccountNotFoundError(id)

    const credentialsChanged: string[] = []
    const patch: Partial<NewClientBankAccount> = {}

    if (dto.username !== undefined) {
      patch.usernameEncrypted = this.encryption.encrypt(dto.username)
      credentialsChanged.push('username')
    }
    if (dto.password !== undefined) {
      patch.passwordEncrypted = this.encryption.encrypt(dto.password)
      credentialsChanged.push('password')
    }
    if (dto.securityQa !== undefined) {
      patch.securityQaEncrypted = dto.securityQa ? this.encryption.encrypt(dto.securityQa) : null
      credentialsChanged.push('securityQa')
    }

    let statusChanged: { from: string; to: string } | null = null
    if (dto.status !== undefined && dto.status !== existing.status) {
      patch.status = dto.status
      statusChanged = { from: existing.status, to: dto.status }
    }

    if (dto.notes !== undefined && dto.notes !== existing.notes) {
      patch.notes = dto.notes
    }

    if (dto.nickname !== undefined && dto.nickname !== existing.nickname) {
      patch.nickname = dto.nickname
    }

    const row = await this.repo.update(id, clientId, patch)
    if (!row) throw new ClientBankAccountNotFoundError(id)

    if (credentialsChanged.length > 0) {
      await this.events.log(
        'client_bank_account.credentials_updated',
        {
          client_bank_account_id: id,
          client_id: clientId,
          bank_portal_id: row.bankPortalId,
          fields_changed: credentialsChanged,
        },
        userId,
        { type: 'client_bank_account', id },
      )
    }
    if (statusChanged) {
      await this.events.log(
        'client_bank_account.status_changed',
        {
          client_bank_account_id: id,
          from_status: statusChanged.from,
          to_status: statusChanged.to,
        },
        userId,
        { type: 'client_bank_account', id },
      )
    }

    return this.toResponse(row)
  }

  async delete(id: string, clientId: string, userId: string): Promise<void> {
    const ok = await this.repo.delete(id, clientId)
    if (!ok) throw new ClientBankAccountNotFoundError(id)
    await this.events.log(
      'client_bank_account.deleted',
      { client_bank_account_id: id, client_id: clientId },
      userId,
      { type: 'client_bank_account', id },
    )
  }

  private toResponse(row: ClientBankAccount): ClientBankAccountResponse {
    return {
      id: row.id,
      client_id: row.clientId,
      bank_portal_id: row.bankPortalId,
      nickname: row.nickname,
      username: row.usernameEncrypted ? this.encryption.decrypt(row.usernameEncrypted) : null,
      password: row.passwordEncrypted ? this.encryption.decrypt(row.passwordEncrypted) : null,
      security_qa: row.securityQaEncrypted
        ? this.encryption.decrypt(row.securityQaEncrypted)
        : null,
      status: row.status,
      notes: row.notes,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }
  }

  // ───── Global API (v0.16.1) ────────────────────────────────────────────

  async listGlobal(filters: ListGlobalFilters): Promise<ListGlobalCredentialsResponse> {
    const { items, total } = await this.repo.listGlobalWithJoins(filters)
    return {
      items: items.map((r) => this.toGlobalResponse(r)),
      total,
      limit: filters.limit ?? 200,
      offset: filters.offset ?? 0,
    }
  }

  async findByIdGlobal(id: string): Promise<GlobalCredentialResponse> {
    const row = await this.repo.findByIdGlobal(id)
    if (!row) throw new ClientBankAccountNotFoundError(id)
    const result = await this.repo.listGlobalWithJoins({
      clientId: row.clientId,
      portalId: row.bankPortalId,
      limit: 1,
      offset: 0,
    })
    const found = result.items[0]
    if (!found) throw new ClientBankAccountNotFoundError(id)
    return this.toGlobalResponse(found)
  }

  async createGlobal(
    dto: CreateGlobalCredentialDto,
    userId: string,
  ): Promise<GlobalCredentialResponse> {
    const portal = await this.portalsRepo.findById(dto.bankPortalId)
    if (!portal) throw new BankPortalNotFoundError(dto.bankPortalId)

    const row = await this.repo.create({
      clientId: dto.clientId,
      bankPortalId: dto.bankPortalId,
      nickname: dto.nickname ?? null,
      usernameEncrypted: this.encryption.encrypt(dto.username),
      passwordEncrypted: this.encryption.encrypt(dto.password),
      securityQaEncrypted: dto.securityQa ? this.encryption.encrypt(dto.securityQa) : null,
      status: dto.status ?? 'active',
      notes: dto.notes ?? null,
    })

    await this.events.log(
      'client_bank_account.created',
      {
        client_bank_account_id: row.id,
        client_id: dto.clientId,
        bank_portal_id: row.bankPortalId,
        status: row.status,
      },
      userId,
      { type: 'client_bank_account', id: row.id },
    )

    // Buscar el row con joins para la respuesta global
    const result = await this.repo.listGlobalWithJoins({
      clientId: dto.clientId,
      portalId: dto.bankPortalId,
      limit: 1,
      offset: 0,
    })
    const found = result.items[0]
    if (!found) throw new ClientBankAccountNotFoundError(row.id)
    return this.toGlobalResponse(found)
  }

  async updateGlobal(
    id: string,
    dto: UpdateClientBankAccountDto,
    userId: string,
  ): Promise<GlobalCredentialResponse> {
    const existing = await this.repo.findByIdGlobal(id)
    if (!existing) throw new ClientBankAccountNotFoundError(id)

    const credentialsChanged: string[] = []
    const patch: Partial<NewClientBankAccount> = {}

    if (dto.username !== undefined) {
      patch.usernameEncrypted = this.encryption.encrypt(dto.username)
      credentialsChanged.push('username')
    }
    if (dto.password !== undefined) {
      patch.passwordEncrypted = this.encryption.encrypt(dto.password)
      credentialsChanged.push('password')
    }
    if (dto.securityQa !== undefined) {
      patch.securityQaEncrypted = dto.securityQa ? this.encryption.encrypt(dto.securityQa) : null
      credentialsChanged.push('securityQa')
    }

    let statusChanged: { from: string; to: string } | null = null
    if (dto.status !== undefined && dto.status !== existing.status) {
      patch.status = dto.status
      statusChanged = { from: existing.status, to: dto.status }
    }
    if (dto.notes !== undefined && dto.notes !== existing.notes) patch.notes = dto.notes
    if (dto.nickname !== undefined && dto.nickname !== existing.nickname) {
      patch.nickname = dto.nickname
    }

    const row = await this.repo.updateGlobal(id, patch)
    if (!row) throw new ClientBankAccountNotFoundError(id)

    if (credentialsChanged.length > 0) {
      await this.events.log(
        'client_bank_account.credentials_updated',
        {
          client_bank_account_id: id,
          client_id: existing.clientId,
          bank_portal_id: existing.bankPortalId,
          fields_changed: credentialsChanged,
        },
        userId,
        { type: 'client_bank_account', id },
      )
    }
    if (statusChanged) {
      await this.events.log(
        'client_bank_account.status_changed',
        {
          client_bank_account_id: id,
          from_status: statusChanged.from,
          to_status: statusChanged.to,
        },
        userId,
        { type: 'client_bank_account', id },
      )
    }

    const result = await this.repo.listGlobalWithJoins({
      clientId: existing.clientId,
      portalId: existing.bankPortalId,
      limit: 1,
      offset: 0,
    })
    const found = result.items[0]
    if (!found) throw new ClientBankAccountNotFoundError(id)
    return this.toGlobalResponse(found)
  }

  async deleteGlobal(id: string, userId: string): Promise<void> {
    const existing = await this.repo.findByIdGlobal(id)
    if (!existing) throw new ClientBankAccountNotFoundError(id)
    const ok = await this.repo.deleteGlobal(id)
    if (!ok) throw new ClientBankAccountNotFoundError(id)
    await this.events.log(
      'client_bank_account.deleted',
      { client_bank_account_id: id, client_id: existing.clientId },
      userId,
      { type: 'client_bank_account', id },
    )
  }

  private toGlobalResponse(row: GlobalCredentialRow): GlobalCredentialResponse {
    return {
      id: row.credential.id,
      client: row.client,
      portal: row.portal,
      nickname: row.credential.nickname,
      username: row.credential.usernameEncrypted
        ? this.encryption.decrypt(row.credential.usernameEncrypted)
        : null,
      password: row.credential.passwordEncrypted
        ? this.encryption.decrypt(row.credential.passwordEncrypted)
        : null,
      security_qa: row.credential.securityQaEncrypted
        ? this.encryption.decrypt(row.credential.securityQaEncrypted)
        : null,
      status: row.credential.status,
      notes: row.credential.notes,
      created_at: row.credential.createdAt.toISOString(),
      updated_at: row.credential.updatedAt.toISOString(),
    }
  }
}
