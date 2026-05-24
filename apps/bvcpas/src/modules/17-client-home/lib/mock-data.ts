// Mock data hardcoded para la Client Home (v0.9.0 visual only).
//
// Cuando lleguen los endpoints reales, cada bloque consumirá su hook
// y este archivo desaparecerá o se moverá a fixtures de tests.

import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  Building2,
  FileText,
  Landmark,
  ListChecks,
  Receipt,
  ScrollText,
  Users,
} from 'lucide-react'

export interface KpiData {
  label: string
  value: string
  meta?: string
  sub?: string
  accent?: 'positive' | 'negative' | 'neutral'
}

export interface ModuleCardData {
  slug: string
  title: string
  subtitle: string
  icon: LucideIcon
  badge?: { text: string; tone: 'amber' | 'green' | 'neutral' }
  rows: { label: string; value: string; valueClass?: string }[]
  cta: string
  progressFilled?: number
  progressTotal?: number
}

export interface WaitingItem {
  title: string
  detail: string
  due: string
  overdue?: boolean
}

export interface ActivityItem {
  when: string
  badge: string
  text: string
}

export const HOME_MOCK = {
  header: {
    greeting: 'Good evening, Alfredo',
    waitingCount: 9,
    period: 'April 2026',
    overdueCount: 3,
    booksThrough: 'Apr 30',
    lastSync: '6h ago',
    clientId: '1042',
    taxYear: '2026',
  },
  kpis: [
    {
      label: 'Open client items',
      value: '9',
      meta: 'items',
      sub: 'across 4 modules · oldest 6d ago',
    },
    {
      label: 'Books closed',
      value: 'Apr 30',
      sub: 'on schedule · next close May 31',
      accent: 'positive' as const,
    },
    {
      label: 'Cash balance',
      value: '$460,715',
      sub: '7% vs last month · 3 accts',
      accent: 'negative' as const,
    },
    {
      label: 'YTD net',
      value: '-$312K',
      sub: 'vs budget · -18% behind',
      accent: 'negative' as const,
    },
  ] satisfies KpiData[],
  closeBanner: {
    title: 'MAY CLOSE — WEEK 3',
    headline: "You need answers on 6 transactions to close April's books",
    detail: 'Sent May 17 · client opened the link · 2 of 6 drafted, 4 untouched · due back Friday',
    cta: 'Open uncat report',
  },
  modules: [
    {
      slug: 'uncategorized-transactions',
      title: 'Uncat. Transactions',
      subtitle: 'Categorize · client notes',
      icon: ListChecks,
      badge: { text: '6 to answer', tone: 'amber' as const },
      rows: [
        { label: 'Pending', value: '6' },
        { label: 'Total amt', value: '$1,244.99' },
        { label: 'Due', value: 'Fri, May 24', valueClass: 'text-amber-600' },
        { label: 'Last sent', value: 'May 17' },
      ],
      cta: 'Send to client',
      progressFilled: 4,
      progressTotal: 10,
    },
    {
      slug: 'reconciliations',
      title: 'Reconciliations',
      subtitle: 'Bank & credit card recs',
      icon: Landmark,
      badge: { text: '2 open', tone: 'amber' as const },
      rows: [
        { label: 'Accounts', value: '5' },
        { label: 'Reconciled', value: '3 / 5' },
        { label: 'As of', value: 'Apr 30' },
        { label: 'Diff.', value: '$0.00' },
      ],
      cta: 'Continue April recs',
      progressFilled: 3,
      progressTotal: 5,
    },
    {
      slug: 'w9',
      title: 'W-9 Requests',
      subtitle: 'Vendor onboarding',
      icon: FileText,
      badge: { text: '3 outstanding', tone: 'amber' as const },
      rows: [
        { label: 'Vendors', value: '12' },
        { label: 'Received', value: '9 / 12' },
        { label: 'Reminders', value: '3 sent' },
        { label: 'Last reply', value: '2d ago' },
      ],
      cta: 'Chase pending',
      progressFilled: 9,
      progressTotal: 12,
    },
    {
      slug: '1099',
      title: '1099 Filings',
      subtitle: 'Contractor year-end',
      icon: Receipt,
      badge: { text: 'Ready', tone: 'green' as const },
      rows: [
        { label: 'Contractors', value: '8' },
        { label: '1099-NEC', value: '8' },
        { label: 'Filed', value: 'Jan 31' },
        { label: 'Total', value: '$112,400' },
      ],
      cta: 'View filings',
      progressFilled: 8,
      progressTotal: 8,
    },
    {
      slug: 'mgt-report',
      title: 'Mgt Report',
      subtitle: 'Monthly P&L package',
      icon: ScrollText,
      badge: { text: 'Apr ready', tone: 'amber' as const },
      rows: [
        { label: 'Period', value: 'Apr 2026' },
        { label: 'Net', value: '-$148,668' },
        { label: 'Sent', value: 'May 8' },
        { label: 'Notes', value: '3 items' },
      ],
      cta: 'Open report',
    },
    {
      slug: 'tax-packet',
      title: 'Tax Packet',
      subtitle: 'Year-end docs',
      icon: Banknote,
      badge: { text: 'In review', tone: 'amber' as const },
      rows: [
        { label: 'Tax year', value: '2025' },
        { label: 'Status', value: 'Draft' },
        { label: 'Docs', value: '14 / 18' },
        { label: 'CPA', value: 'M. Rivera' },
      ],
      cta: 'Review packet',
      progressFilled: 14,
      progressTotal: 18,
    },
    {
      slug: 'qtr-payroll',
      title: 'QTR Payroll',
      subtitle: 'Quarterly 941/940',
      icon: Users,
      badge: { text: 'Q2 due Jul 31', tone: 'amber' as const },
      rows: [
        { label: 'Employees', value: '24' },
        { label: 'Q1 941', value: 'Filed' },
        { label: 'Q2 941', value: 'Open' },
        { label: 'Liability', value: '$38,450' },
      ],
      cta: 'Start Q2 prep',
    },
    {
      slug: 'property-tax',
      title: 'Property Tax',
      subtitle: 'Real estate filings',
      icon: Building2,
      badge: { text: 'Nov 30', tone: 'neutral' as const },
      rows: [
        { label: 'Properties', value: '3' },
        { label: 'Assessed', value: '$2.4M' },
        { label: 'Next due', value: 'Nov 30' },
        { label: 'Appealed', value: '1' },
      ],
      cta: 'View properties',
    },
  ] satisfies ModuleCardData[],
  bookkeeper: {
    initials: 'MR',
    name: 'Maria Rivera',
    title: 'Lead CPA · responds within 4h',
    thread:
      'Hey Alfredo — I started 4 invoice drafts from your usual recurring clients. Can you confirm the rate for St. Joseph\'s before Friday?',
  },
  waiting: [
    {
      title: '6 transactions need a note',
      detail: 'Uncat. Transactions · sent May 17',
      due: 'Due Fri',
    },
    {
      title: 'W-9 from 3 vendors',
      detail: 'Eagle Plumbing · ProSign LLC · Northbrook',
      due: 'Overdue 2d',
      overdue: true,
    },
    {
      title: 'Approve March Mgt Report',
      detail: 'Mgt Report · sent Apr 9',
      due: 'May 30',
    },
    {
      title: 'Confirm Q2 payroll dates',
      detail: 'QTR Payroll · prep window opens Jun 15',
      due: 'Jun 14',
    },
  ] satisfies WaitingItem[],
  recent: [
    {
      when: '2h ago',
      badge: 'Uncat',
      text: 'Client drafted note on Home Depot $312.49',
    },
    {
      when: '6h ago',
      badge: 'Bank',
      text: 'QBO sync completed · 18 new txns imported',
    },
  ] satisfies ActivityItem[],
} as const
