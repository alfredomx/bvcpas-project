'use client'

import { MessageSquare, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/shared/section-header'

import { HOME_MOCK } from '../lib/mock-data'

export function ChHeader({ legalName }: { legalName: string }) {
  const h = HOME_MOCK.header
  return (
    <div className="flex flex-col gap-3">
      <SectionHeader
        kicker={`Client home · ${legalName}`}
        title={`${h.greeting} · ${h.waitingCount} items waiting on the client`}
        actions={
          <>
            <Button type="button" variant="outline" size="sm">
              <MessageSquare className="size-4" />
              Message client
            </Button>
            <Button type="button" size="sm">
              <Send className="size-4" />
              Send weekly report
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Chip>Period · {h.period}</Chip>
        <Chip>{h.overdueCount} items overdue</Chip>
        <Chip>Books current through {h.booksThrough}</Chip>
        <Chip>Last sync · {h.lastSync}</Chip>
      </div>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  )
}
