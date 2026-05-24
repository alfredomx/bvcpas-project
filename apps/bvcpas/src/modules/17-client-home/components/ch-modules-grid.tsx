'use client'

import { HOME_MOCK } from '../lib/mock-data'

import { ChModuleCard } from './ch-module-card'

export function ChModulesGrid({ clientId }: { clientId: string }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-base font-semibold">Modules</h2>
          <p className="text-xs text-muted-foreground">
            Subsections for this client
          </p>
        </div>
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Customize order
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {HOME_MOCK.modules.map((m) => (
          <ChModuleCard key={m.slug} clientId={clientId} data={m} />
        ))}
      </div>
    </section>
  )
}
