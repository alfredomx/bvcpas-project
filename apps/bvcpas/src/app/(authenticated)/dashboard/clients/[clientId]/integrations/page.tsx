'use client'

import { use } from 'react'

import { useClients } from '@/modules/11-clients/hooks/use-clients'
import { IntegrationsScreen } from '@/modules/18-integrations/components/integrations-screen'

export default function IntegrationsPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = use(params)
  const { items } = useClients()
  const client = items.find((c) => c.id === clientId)
  const legalName = client?.legal_name ?? 'Client'

  return <IntegrationsScreen clientId={clientId} legalName={legalName} />
}
