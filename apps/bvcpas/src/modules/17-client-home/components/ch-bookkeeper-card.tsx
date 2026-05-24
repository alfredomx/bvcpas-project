'use client'

import { MessageSquare, Phone } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { HOME_MOCK } from '../lib/mock-data'

export function ChBookkeeperCard() {
  const b = HOME_MOCK.bookkeeper
  return (
    <section className="flex flex-col gap-3 rounded-md border bg-background p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Bookkeeper
      </p>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-semibold">
          {b.initials}
        </div>
        <div className="flex flex-col">
          <p className="text-sm font-semibold">{b.name}</p>
          <p className="text-xs text-muted-foreground">{b.title}</p>
        </div>
      </div>
      <div className="rounded border bg-muted/40 p-3 text-xs leading-relaxed">
        {b.thread}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1">
          <MessageSquare className="size-4" />
          Message
        </Button>
        <Button type="button" size="sm" className="flex-1">
          <Phone className="size-4" />
          Book call
        </Button>
      </div>
    </section>
  )
}
