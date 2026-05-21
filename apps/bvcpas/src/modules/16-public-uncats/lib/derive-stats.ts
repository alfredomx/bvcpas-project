// Calcula los KPIs que se muestran en el header desde la lista plana
// de items. Mismas fórmulas que el dashboard interno (responded /
// total * 100), redondeo a entero.

import type { PublicUncatsResponseItem } from '../api/public-uncats.api'

export interface PublicStats {
  transactionsCount: number
  totalAmount: string
  pendingAmount: string
  respondedCount: number
  progressPct: number
}

export function deriveStats(items: PublicUncatsResponseItem[]): PublicStats {
  const transactionsCount = items.length
  let totalAmountNum = 0
  let pendingAmountNum = 0
  let respondedCount = 0
  for (const i of items) {
    const n = Number(i.amount)
    if (!Number.isFinite(n)) continue
    totalAmountNum += n
    if (i.response !== null) {
      respondedCount += 1
    } else {
      pendingAmountNum += n
    }
  }
  const progressPct =
    transactionsCount === 0
      ? 0
      : Math.round((respondedCount / transactionsCount) * 100)
  return {
    transactionsCount,
    totalAmount: totalAmountNum.toFixed(2),
    pendingAmount: pendingAmountNum.toFixed(2),
    respondedCount,
    progressPct,
  }
}
