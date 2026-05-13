'use client'

// Pantalla de la tab Uncat. Transactions para un cliente concreto.
// Compone los 5 sub-componentes presentacionales con la data del
// hook `useUncatsDetail`.
//
// El estado de la tab activa (uncategorized / amas) vive aquí — lo
// comparten <CsActivityTimeline> (lectura) y <CsTransactions>
// (lectura + setter). Cuando el operador cambia de tab, el timeline
// se repinta con la métrica correspondiente.

import { useState } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { useUncatsDetail } from '@/modules/13-dashboards/hooks/use-uncats-detail'
import { useQboAccounts } from '@/modules/14-transactions/hooks/use-qbo-accounts'

import type { UncatsDetailResponse } from '@/modules/13-dashboards/api/uncats-detail.api'

import { CsActivityTimeline } from './cs-activity-timeline'
import { CsHeader } from './cs-header'
import { CsQuickLinks } from './cs-quick-links'
import { CsStatsGrid } from './cs-stats-grid'
import { CsSuggestedAction } from './cs-suggested-action'
import {
  CsTransactions,
  type ClientFilter,
  type TransactionsTab,
} from './cs-transactions'

export interface CustomerSupportScreenProps {
  clientId: string
}

/**
 * El card "Suggested next action" se muestra si:
 *  - hay uncats pendientes, y
 *  - el cliente no ha sido notificado en el mes/año actual (incluye
 *    `sent_at = null`).
 *
 * Se considera "mes anterior" cualquier fecha estrictamente menor al
 * primer día del mes actual (mes/año).
 */
function shouldShowSuggested(
  stats: UncatsDetailResponse['stats'],
  followup: UncatsDetailResponse['followup'],
  now: Date = new Date(),
): boolean {
  if (stats.uncats_count <= 0) return false
  if (!followup.sent_at) return true
  const sent = new Date(followup.sent_at)
  if (Number.isNaN(sent.getTime())) return true
  const currentYM = now.getUTCFullYear() * 12 + now.getUTCMonth()
  const sentYM = sent.getUTCFullYear() * 12 + sent.getUTCMonth()
  return sentYM < currentYM
}

export function CustomerSupportScreen({ clientId }: CustomerSupportScreenProps) {
  const { data, isLoading, isError } = useUncatsDetail(clientId)
  const [tab, setTab] = useState<TransactionsTab>('uncategorized')
  const { accounts } = useQboAccounts(data?.client.qbo_realm_id ?? null)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6" data-testid="cs-screen-loading">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <section
        className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center"
        data-testid="cs-screen-error"
      >
        <h2 className="text-lg font-semibold">Could not load customer support data</h2>
        <p className="text-sm text-muted-foreground">
          The request to mapi failed. Try again in a moment.
        </p>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <CsHeader
        client={data.client}
        followup={data.followup}
        publicLink={data.public_link}
      />
      <CsQuickLinks client={data.client} publicLink={data.public_link} />
      <CsActivityTimeline monthly={data.monthly} mode={tab} />
      <CsStatsGrid stats={data.stats} />
      <CsTransactions
        clientId={data.client.id}
        realmId={data.client.qbo_realm_id}
        accounts={accounts}
        clientFilter={data.client.transactions_filter as ClientFilter}
        tab={tab}
        onTabChange={setTab}
        middleSlot={
          shouldShowSuggested(data.stats, data.followup) ? (
            <CsSuggestedAction
              client={data.client}
              followup={data.followup}
              stats={data.stats}
              publicLink={data.public_link}
            />
          ) : null
        }
      />
    </div>
  )
}
