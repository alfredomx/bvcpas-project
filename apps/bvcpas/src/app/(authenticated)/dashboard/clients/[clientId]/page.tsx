'use client'

// Home del cliente — visual only (v0.9.0). Mock data hardcoded.
// Cuando existan endpoints, cada bloque del <ClientHomeScreen>
// consumirá su hook sin tocar este page.

import { use } from 'react'

import { useClients } from '@/modules/11-clients/hooks/use-clients'
import { ClientHomeScreen } from '@/modules/17-client-home/components/client-home-screen'

export default function ClientHomePage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = use(params)
  const { items } = useClients()
  const client = items.find((c) => c.id === clientId)
  const legalName = client?.legal_name ?? 'Client'

  return <ClientHomeScreen clientId={clientId} legalName={legalName} />
}
