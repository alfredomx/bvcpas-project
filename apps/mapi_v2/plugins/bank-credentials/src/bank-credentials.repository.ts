import { Inject, Injectable } from '@nestjs/common'
import { and, eq, ilike, or, type SQL } from 'drizzle-orm'
import { DB, type DrizzleDb } from '@/core/db/db.module'
import {
  bankCredentials,
  type BankCredential,
  type BankCredentialStatus,
  type NewBankCredential,
} from './bank-credentials.schema'
import { bankPortals, type BankPortal } from './bank-portals.schema'

export interface CredentialListFilters {
  clientId?: string
  portalId?: string
  status?: BankCredentialStatus
  search?: string
}

/** Credencial + su portal (join), para listas y detalle. */
export interface CredentialWithPortal {
  credential: BankCredential
  portal: BankPortal
}

/**
 * Acceso a datos de `bank_credentials`. Guarda/lee los secretos YA cifrados
 * (el cifrado/descifrado vive en `BankCredentialsService`).
 */
@Injectable()
export class BankCredentialsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async create(data: NewBankCredential): Promise<BankCredential> {
    const [row] = await this.db.insert(bankCredentials).values(data).returning()
    return row
  }

  async findById(id: string): Promise<BankCredential | null> {
    const [row] = await this.db
      .select()
      .from(bankCredentials)
      .where(eq(bankCredentials.id, id))
      .limit(1)
    return row ?? null
  }

  async findByIdWithPortal(id: string): Promise<CredentialWithPortal | null> {
    const [row] = await this.db
      .select({ credential: bankCredentials, portal: bankPortals })
      .from(bankCredentials)
      .innerJoin(bankPortals, eq(bankCredentials.bankPortalId, bankPortals.id))
      .where(eq(bankCredentials.id, id))
      .limit(1)
    return row ?? null
  }

  async list(f: CredentialListFilters): Promise<CredentialWithPortal[]> {
    const conds: SQL[] = []
    if (f.clientId) conds.push(eq(bankCredentials.clientId, f.clientId))
    if (f.portalId) conds.push(eq(bankCredentials.bankPortalId, f.portalId))
    if (f.status) conds.push(eq(bankCredentials.status, f.status))
    if (f.search) {
      const term = `%${f.search}%`
      conds.push(
        or(
          ilike(bankPortals.name, term),
          ilike(bankCredentials.nickname, term),
          ilike(bankCredentials.notes, term),
        )!,
      )
    }
    return this.db
      .select({ credential: bankCredentials, portal: bankPortals })
      .from(bankCredentials)
      .innerJoin(bankPortals, eq(bankCredentials.bankPortalId, bankPortals.id))
      .where(conds.length ? and(...conds) : undefined)
  }

  async update(id: string, patch: Partial<NewBankCredential>): Promise<BankCredential | null> {
    const [row] = await this.db
      .update(bankCredentials)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(bankCredentials.id, id))
      .returning()
    return row ?? null
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(bankCredentials)
      .where(eq(bankCredentials.id, id))
      .returning({ id: bankCredentials.id })
    return rows.length > 0
  }
}
