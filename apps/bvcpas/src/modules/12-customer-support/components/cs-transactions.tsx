'use client'

// Bloque inferior de la tab Uncat. Transactions: leyenda del filter +
// botón Sync + tabs Uncategorized / AMA's con tablas.

import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSyncTransactions } from '@/modules/14-transactions/hooks/use-sync-transactions'
import { useTransactions } from '@/modules/14-transactions/hooks/use-transactions'
import type { Transaction } from '@/modules/14-transactions/api/transactions.api'

import { computeRange } from '../lib/date-range'
import { formatAmount } from '../lib/format'

export type ClientFilter = 'all' | 'income' | 'expense'

export interface CsTransactionsProps {
  clientId: string
  /** transactions_filter del cliente (afecta sólo el follow-up al cliente). */
  clientFilter: ClientFilter
}

function filterLegend(filter: ClientFilter): string {
  if (filter === 'all') return 'Follow-ups send: expense + income'
  if (filter === 'expense') return 'Follow-ups send: expense only'
  return 'Follow-ups send: income only'
}

function formatDate(iso: string): string {
  // Backend manda YYYY-MM-DD. Solo reformateamos a MM/DD/YYYY.
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  return `${m[2]}/${m[3]}/${m[1]}`
}

function formatSignedAmount(t: Transaction): string {
  const isIncome = t.category === 'uncategorized_income'
  const formatted = formatAmount(t.amount)
  if (isIncome) return formatted
  // Expense + AMA → negativo visual.
  return formatted.startsWith('-') ? formatted : `-${formatted}`
}

interface TxTableProps {
  items: Transaction[]
  isLoading: boolean
  isError: boolean
}

function TxTable({ items, isLoading, isError }: TxTableProps) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading transactions…</p>
  }
  if (isError) {
    return <p className="text-sm text-destructive">Could not load transactions.</p>
  }
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No transactions in this category.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Id</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Check #</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Memo/Description</TableHead>
          <TableHead>Split</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="font-mono text-xs">{t.qbo_txn_id}</TableCell>
            <TableCell>{formatDate(t.txn_date)}</TableCell>
            <TableCell>{t.qbo_txn_type}</TableCell>
            <TableCell>{t.docnum ?? ''}</TableCell>
            <TableCell>{t.vendor_name ?? ''}</TableCell>
            <TableCell className="max-w-xs truncate" title={t.memo ?? undefined}>
              {t.memo ?? ''}
            </TableCell>
            <TableCell>{t.split_account ?? ''}</TableCell>
            <TableCell>{t.category}</TableCell>
            <TableCell className="text-right font-mono">{formatSignedAmount(t)}</TableCell>
            <TableCell />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function CsTransactions({ clientId, clientFilter }: CsTransactionsProps) {
  const [tab, setTab] = useState<'uncategorized' | 'amas'>('uncategorized')

  const expenseQuery = useTransactions(clientId, 'uncategorized_expense')
  const incomeQuery = useTransactions(clientId, 'uncategorized_income')
  const amaQuery = useTransactions(clientId, 'ask_my_accountant')

  const uncategorizedItems = useMemo(() => {
    const merged = [...expenseQuery.items, ...incomeQuery.items]
    return merged.sort((a, b) => b.txn_date.localeCompare(a.txn_date))
  }, [expenseQuery.items, incomeQuery.items])

  const sync = useSyncTransactions(clientId)

  const handleSync = () => {
    const range = computeRange(new Date())
    sync.mutate(
      { startDate: range.from, endDate: range.to },
      {
        onSuccess: (result) => {
          toast.success(
            `Sync complete: ${result.inserted_count} inserted, ${result.deleted_count} replaced.`,
          )
        },
        onError: (err) => {
          const status = (err as { statusCode?: number; status?: number } | undefined)
            ?.statusCode
          if (status === 400) {
            toast.error('This client has no QBO connection. Connect QuickBooks first.')
          } else {
            toast.error('Sync failed. Try again in a moment.')
          }
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {filterLegend(clientFilter)}
        </p>
        <Button onClick={handleSync} disabled={sync.isPending}>
          {sync.isPending ? 'Syncing…' : 'Sync'}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList>
          <TabsTrigger value="uncategorized">
            Uncategorized ({uncategorizedItems.length})
          </TabsTrigger>
          <TabsTrigger value="amas">AMA's ({amaQuery.items.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="uncategorized" className="mt-3">
          <TxTable
            items={uncategorizedItems}
            isLoading={expenseQuery.isLoading || incomeQuery.isLoading}
            isError={expenseQuery.isError || incomeQuery.isError}
          />
        </TabsContent>
        <TabsContent value="amas" className="mt-3">
          <TxTable
            items={amaQuery.items}
            isLoading={amaQuery.isLoading}
            isError={amaQuery.isError}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

