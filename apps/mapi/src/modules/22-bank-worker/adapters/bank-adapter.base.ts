import type { DomStep } from '../../23-plugin-bridge/bridge.types'
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

/** Credenciales descifradas que recibe el adapter para armar la receta de login. */
export interface BankLoginCredentials {
  username: string
  password: string
  securityQa?: string | null
}

/**
 * Receta de login: la URL del logonbox a abrir + los pasos DOM (fill/click) que
 * kiro ejecuta a ciegas. La lógica (selectores) vive en el adapter (mapi); kiro
 * sigue tonto. La navegación a `url` la hace mapi con `open_tab`/`list_tabs`,
 * NO es un paso DOM (recargar mata el content script).
 */
export interface BankLoginRecipe {
  url: string
  steps: DomStep[]
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

  /**
   * Construye la receta de login (URL del logonbox + pasos DOM) con las
   * credenciales descifradas. Opcional: un banco cuyo login no esté automatizado
   * no la implementa → el caller lanza `BankLoginNotSupportedError`.
   */
  buildLoginRecipe?(creds: BankLoginCredentials): BankLoginRecipe

  /** MM-DD-YYYY → YYYYMMDD (formato clásico de APIs financieras). */
  protected _formatDate(dateStr: string): string {
    const [m, d, y] = dateStr.split('-')
    return `${y}${m}${d}`
  }
}
