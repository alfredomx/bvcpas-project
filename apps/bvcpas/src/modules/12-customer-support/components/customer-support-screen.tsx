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

export function CustomerSupportScreen({ clientId }: CustomerSupportScreenProps) {
  const { data, isLoading, isError } = useUncatsDetail(clientId)
  const [tab, setTab] = useState<TransactionsTab>('uncategorized')

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
      <CsHeader client={data.client} followup={data.followup} />
      <CsQuickLinks />
      <CsActivityTimeline monthly={data.monthly} mode={tab} />
      <CsStatsGrid stats={data.stats} />
      <CsSuggestedAction
        client={data.client}
        followup={data.followup}
        stats={data.stats}
      />
      <CsTransactions
        clientId={data.client.id}
        realmId={data.client.qbo_realm_id}
        clientFilter={data.client.transactions_filter as ClientFilter}
        tab={tab}
        onTabChange={setTab}
      />
    </div>
  )
}
