// Mock data hardcoded para Integrations (v0.9.0 visual only).
// Cuando lleguen los endpoints reales (lo de Shopify/Amazon/Gusto no
// existe aún en mapi), este archivo se reemplaza por hooks.

export type ConnectionStatus = 'connected' | 'reauth' | 'failed'

export interface IntegrationKpi {
  label: string
  value: string
  sub: string
}

export interface Connection {
  id: string
  provider: string
  initials: string
  title: string
  accountLabel: string
  accountDomain: string
  syncFrequency: string
  addedBy: string
  addedAt: string
  status: ConnectionStatus
  statusDetail?: string
  lastSyncRelative: string
}

export interface MappingRow {
  qboField: string
  required?: boolean
  value: string // siempre 'No Match' en mock (decisión)
}

export interface ActivityEntry {
  when: string
  text: string
}

export const INTEGRATIONS_MOCK = {
  kpis: [
    { label: 'Connected', value: '6', sub: 'across 5 providers' },
    { label: 'Healthy', value: '4', sub: 'syncing on schedule' },
    { label: 'Needs attention', value: '1', sub: 're-auth or mapping required' },
    { label: 'Errors', value: '1', sub: 'sync paused' },
    { label: 'Available', value: '14+', sub: 'providers in catalog' },
  ] satisfies IntegrationKpi[],
  connections: [
    {
      id: 'clover-primary',
      provider: 'clover',
      initials: 'CL',
      title: 'Clover Connector',
      accountLabel: 'Blanco To Go',
      accountDomain: '',
      syncFrequency: '',
      addedBy: '',
      addedAt: 'Mar 14',
      status: 'connected',
      lastSyncRelative: '',
    }
  ] satisfies Connection[],
  mappingRows: [
    { qboField: 'Product/Service Name', required: true, value: 'No Match' },
    { qboField: 'SKU', value: 'No Match' },
    { qboField: 'Type', value: 'No Match' },
    { qboField: 'Sales Description', value: 'No Match' },
    { qboField: 'Sales Price/Rate', value: 'No Match' },
    { qboField: 'Taxable', value: 'No Match' },
    { qboField: 'Income Account', required: true, value: 'No Match' },
    { qboField: 'Purchase Description', value: 'No Match' },
    { qboField: 'Purchase Cost', value: 'No Match' },
    { qboField: 'Expense Account', value: 'No Match' },
    { qboField: 'Quantity On Hand', value: 'No Match' },
    { qboField: 'Reorder Point', value: 'No Match' },
    { qboField: 'Inventory Asset Account', value: 'No Match' },
    { qboField: 'Quantity as-of Date', value: 'No Match' },
  ] satisfies MappingRow[],
  mappingOptions: ['No Match', 'Item Name', 'Description', 'Price'] as const,
  activity: [
    { when: '4m ago', text: 'Sync completed · 12 new transactions imported' },
    { when: '19m ago', text: 'Sync started · pulling orders since 2026-05-22 14:00' },
    { when: '2h ago', text: 'Field mapping changed: Sales Description → Description' },
    { when: 'Yest', text: 'Maria Rivera updated default deposit account' },
    { when: 'May 20', text: 'OAuth token refreshed automatically' },
    { when: 'May 14', text: 'Sync failed · network timeout · retried successfully 3m later' },
  ] satisfies ActivityEntry[],
} as const
