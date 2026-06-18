import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DB, type DrizzleDb } from '@/core/db/db.module'
import { bankPortals, type BankPortal, type NewBankPortal } from './bank-portals.schema'

/** Acceso a datos de `bank_portals` (catálogo global de bancos). */
@Injectable()
export class BankPortalsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  async create(data: NewBankPortal): Promise<BankPortal> {
    const [row] = await this.db.insert(bankPortals).values(data).returning()
    return row
  }

  async findById(id: string): Promise<BankPortal | null> {
    const [row] = await this.db.select().from(bankPortals).where(eq(bankPortals.id, id)).limit(1)
    return row ?? null
  }

  async findByName(name: string): Promise<BankPortal | null> {
    const [row] = await this.db
      .select()
      .from(bankPortals)
      .where(eq(bankPortals.name, name))
      .limit(1)
    return row ?? null
  }

  async list(): Promise<BankPortal[]> {
    return this.db.select().from(bankPortals).orderBy(bankPortals.name)
  }
}
