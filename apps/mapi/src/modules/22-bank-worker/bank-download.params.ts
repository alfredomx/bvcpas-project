import { BadRequestException } from '@nestjs/common'
import {
  DownloadChecksSchema,
  DownloadDepositsSchema,
  DownloadStatementsSchema,
  DownloadTransactionsSchema,
  type ListAccountsResponse,
  type ORCHESTRATE_WHATS,
} from './dto/bank-download.dto'

export type DownloadWhat = (typeof ORCHESTRATE_WHATS)[number]

/** Schema del DTO de descarga por tipo (valida `params` + credentialId + masks). */
export const SCHEMA_BY_WHAT = {
  checks: DownloadChecksSchema,
  deposits: DownloadDepositsSchema,
  statements: DownloadStatementsSchema,
  transactions: DownloadTransactionsSchema,
} as const

// Placeholders para validar `params` antes de tener credencial/masks reales.
const PLACEHOLDER_CRED = '00000000-0000-4000-8000-000000000000'
const PLACEHOLDER_MASKS = ['0000']

/**
 * Valida solo la forma de `params` (range/from/to/year/month/format) al recibir
 * el POST, antes de encolar nada. Usa placeholders para credentialId/masks (aún
 * no se conocen sin login). Inválido → 400. El worker re-valida con datos reales.
 */
export function validateParamsShape(what: DownloadWhat, params: Record<string, unknown>): void {
  const r = SCHEMA_BY_WHAT[what].safeParse({
    ...params,
    credentialId: PLACEHOLDER_CRED,
    accountMasks: PLACEHOLDER_MASKS,
  })
  if (!r.success) {
    // Ignora errores de los placeholders (no deberían fallar); reporta el resto.
    const issues = r.error.issues.filter(
      (i) => !(i.path[0] === 'credentialId' || i.path[0] === 'accountMasks'),
    )
    if (issues.length > 0) {
      throw new BadRequestException({
        message: `Parámetros inválidos para "${what}": ${issues.map((i) => i.message).join('; ')}`,
      })
    }
  }
}

/** "all" (o vacío) → todas las masks del login (deduplicadas); si no, las pedidas. */
export function resolveMasks(live: ListAccountsResponse, accounts?: 'all' | string[]): string[] {
  const source = !accounts || accounts === 'all' ? live.accounts.map((a) => a.mask) : accounts
  return [...new Set(source)]
}

/** Arma el DTO real del tipo y lo valida (con masks ya resueltas); inválido → 400. */
export function buildDownloadDto(
  what: DownloadWhat,
  credentialId: string,
  accountMasks: string[],
  params: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = SCHEMA_BY_WHAT[what].safeParse({ ...params, credentialId, accountMasks })
  if (!parsed.success) {
    throw new BadRequestException({
      message: `Parámetros inválidos para "${what}": ${parsed.error.issues
        .map((i) => i.message)
        .join('; ')}`,
    })
  }
  return parsed.data
}
