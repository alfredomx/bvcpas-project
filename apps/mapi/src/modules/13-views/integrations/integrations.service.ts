import { Injectable } from '@nestjs/common'
import { ClientsRepository } from '../../11-clients/clients.repository'
import { ClientNotFoundError } from '../../11-clients/clients.errors'
import type { UserConnection, Provider } from '../../../db/schema/user-connections'
import { ConnectionStatusResolver, type ConnectionStatus } from './connection-status.resolver'
import { IntegrationsRepository } from './integrations.repository'

/**
 * Mapping fijo provider → label legible para el dashboard.
 * Solo providers client-scoped (Clover, Square). Si más adelante entran
 * más providers a este scope, se agregan aquí.
 */
const PROVIDER_LABEL: Record<string, string> = {
  clover: 'Clover',
  square: 'Square',
}

export interface IntegrationConnectionItem {
  id: string
  provider: Provider
  providerLabel: string
  label: string | null
  externalAccountId: string
  authType: 'oauth' | 'api_key'
  status: ConnectionStatus
  statusReason: string | null
  pausedAt: string | null
  pausedReason: string | null
  lastSyncAt: string | null
  createdAt: string
}

export interface IntegrationStats {
  connected: number
  healthy: number
  needsAttention: number
  errors: number
  providersInUse: number
}

export interface IntegrationsDashboard {
  client: { id: string; legalName: string }
  stats: IntegrationStats
  connections: IntegrationConnectionItem[]
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly repo: IntegrationsRepository,
    private readonly clientsRepo: ClientsRepository,
    private readonly resolver: ConnectionStatusResolver,
  ) {}

  async getDashboard(clientId: string): Promise<IntegrationsDashboard> {
    const client = await this.clientsRepo.findById(clientId)
    if (!client) throw new ClientNotFoundError(clientId)

    const rows = await this.repo.listByClient(clientId)
    const connections = rows.map((row) => this.toItem(row))
    const stats = this.buildStats(connections, rows)

    return {
      client: { id: client.id, legalName: client.legalName },
      stats,
      connections,
    }
  }

  private toItem(row: UserConnection): IntegrationConnectionItem {
    const { status, reason } = this.resolver.resolve(row)
    return {
      id: row.id,
      provider: row.provider as Provider,
      providerLabel: PROVIDER_LABEL[row.provider] ?? row.provider,
      label: row.label,
      externalAccountId: row.externalAccountId,
      authType: row.authType as 'oauth' | 'api_key',
      status,
      statusReason: reason,
      pausedAt: row.pausedAt ? row.pausedAt.toISOString() : null,
      pausedReason: row.pausedReason,
      lastSyncAt: null, // v0.14.0: no trackeamos last sync todavía
      createdAt: row.createdAt.toISOString(),
    }
  }

  private buildStats(items: IntegrationConnectionItem[], rows: UserConnection[]): IntegrationStats {
    const distinctProviders = new Set(rows.map((r) => r.provider))
    return {
      connected: items.length,
      healthy: items.filter((i) => i.status === 'healthy').length,
      needsAttention: items.filter((i) => i.status === 'needs_reauth').length,
      errors: items.filter((i) => i.status === 'paused').length,
      providersInUse: distinctProviders.size,
    }
  }
}
