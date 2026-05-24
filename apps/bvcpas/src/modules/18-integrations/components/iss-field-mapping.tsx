'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { INTEGRATIONS_MOCK } from '../lib/mock-data'

export function IssFieldMapping() {
  const filled = INTEGRATIONS_MOCK.mappingRows.filter(
    (r) => r.value !== 'No Match',
  ).length
  const total = INTEGRATIONS_MOCK.mappingRows.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Map your fields to QuickBooks fields. Required fields are marked with{' '}
          <span className="font-semibold">*</span>. &ldquo;No match&rdquo;
          means the connector will skip that field on import.
        </p>
        <div className="flex shrink-0 flex-col items-center rounded border bg-muted/40 px-3 py-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mapping
          </span>
          <span className="text-sm font-bold tabular-nums">
            {filled}/{total}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="grid grid-cols-2 border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>QuickBooks Online field</span>
          <span>Your field</span>
        </div>
        {INTEGRATIONS_MOCK.mappingRows.map((row) => (
          <div
            key={row.qboField}
            className="grid grid-cols-2 items-center gap-3 border-b px-3 py-2 last:border-b-0"
          >
            <span className="text-sm">
              {row.qboField}
              {row.required && (
                <span className="ml-1 text-muted-foreground">*</span>
              )}
            </span>
            <Select defaultValue={row.value}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTEGRATIONS_MOCK.mappingOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  )
}
