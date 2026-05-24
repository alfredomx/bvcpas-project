'use client'

// Pantalla home del cliente. Todo visual + mock data. Cuando lleguen
// los endpoints reales, cada bloque consumirá su hook sin tocar este
// contenedor.

import { ChBookkeeperCard } from './ch-bookkeeper-card'
import { ChCloseBanner } from './ch-close-banner'
import { ChHeader } from './ch-header'
import { ChKpis } from './ch-kpis'
import { ChModulesGrid } from './ch-modules-grid'
import { ChRecentActivity } from './ch-recent-activity'
import { ChWaitingList } from './ch-waiting-list'

export interface ClientHomeScreenProps {
  clientId: string
  legalName: string
}

export function ClientHomeScreen({ clientId, legalName }: ClientHomeScreenProps) {
  return (
    <div className="flex w-full flex-col gap-4 px-6 py-6">
      <ChHeader legalName={legalName} />
      <ChKpis />
      <ChCloseBanner clientId={clientId} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <ChModulesGrid clientId={clientId} />
        <aside className="flex flex-col gap-4">
          <ChBookkeeperCard />
          <ChWaitingList />
          <ChRecentActivity />
        </aside>
      </div>
    </div>
  )
}
