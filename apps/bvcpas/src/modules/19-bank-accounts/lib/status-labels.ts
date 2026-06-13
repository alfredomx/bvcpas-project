// Mapeo de status (backend → label visible) + clase de Tailwind para
// el bullet de color. Badge texto neutro, bullet con color: coherente
// con el resto del frontend y satisface la instrucción de mapi.

import type { BankAccountStatus, BankLoginStatus } from '../api/bank-accounts.api'

export interface StatusDef {
  label: string
  dot: string
}

export const LOGIN_STATUS: Record<BankLoginStatus, StatusDef> = {
  active: { label: 'Active', dot: 'bg-emerald-500' },
  blocked: { label: 'Blocked', dot: 'bg-amber-500' },
  closed: { label: 'Closed', dot: 'bg-zinc-400' },
}

export const ACCOUNT_STATUS: Record<BankAccountStatus, StatusDef> = {
  active: { label: 'Active', dot: 'bg-emerald-500' },
  blocked: { label: 'Blocked', dot: 'bg-amber-500' },
  closed: { label: 'Closed', dot: 'bg-zinc-400' },
}
