import type { BankFetchExecutor } from './bank-fetch.types'

/**
 * Contrato base de un adapter bancario (portado de `IBankAdapter` del proyecto
 * original). Cada banco implementa estos métodos. Si un banco no soporta una
 * operación, el método lanza un error.
 *
 * Fechas entran/salen en `MM-DD-YYYY` (formato público); cada adapter convierte
 * al formato interno del banco. El transporte es un `BankFetchExecutor`
 * (Design B): el adapter pide fetches, el plugin los ejecuta en la sesión viva.
 */
export interface BankAccount {
  /** ID interno del banco. */
  id: string
  /** Últimos 4 dígitos. */
  mask: string
  /** Tipo genérico (ej. 'checking', 'credit'). */
  type: string
  /** Nombre descriptivo (opcional). */
  name?: string
}

export abstract class BankAdapter {
  protected constructor(protected readonly exec: BankFetchExecutor) {}

  abstract getAllAccounts(): Promise<BankAccount[]>
  abstract searchTransactions(
    accountMask: string,
    dateFrom: string,
    dateTo: string,
    type: 'CHECK' | 'DEPOSIT',
  ): Promise<unknown[]>
  abstract downloadChecks(accountMask: string, dateFrom: string, dateTo: string): Promise<unknown>
  abstract downloadDeposits(accountMask: string, dateFrom: string, dateTo: string): Promise<unknown>
  abstract downloadTransactions(
    accountMask: string,
    dateFrom: string,
    dateTo: string,
    format: 'CSV' | 'QBO',
  ): Promise<unknown>
  abstract downloadStatements(accountMask: string, year: string, month: string): Promise<unknown>

  /** MM-DD-YYYY → YYYYMMDD (formato clásico de APIs financieras). */
  protected _formatDate(dateStr: string): string {
    const [m, d, y] = dateStr.split('-')
    return `${y}${m}${d}`
  }
}
