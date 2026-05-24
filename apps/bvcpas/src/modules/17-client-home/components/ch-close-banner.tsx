'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { HOME_MOCK } from '../lib/mock-data'

export function ChCloseBanner({ clientId }: { clientId: string }) {
  const b = HOME_MOCK.closeBanner
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 px-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {b.title}
          </p>
          <p className="text-sm font-medium">{b.headline}</p>
          <p className="text-sm text-muted-foreground">{b.detail}</p>
        </div>
        <Button asChild>
          <a href={`/dashboard/clients/${clientId}/uncategorized-transactions`}>
            {b.cta} →
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
