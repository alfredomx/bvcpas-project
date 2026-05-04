import { randomBytes } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { EventLogService } from '../../95-event-log/event-log.service'
import {
  PublicLinkExpiredError,
  PublicLinkInvalidError,
  PublicLinkPurposeMismatchError,
  PublicLinkRevokedError,
} from '../customer-support.errors'
import type { ClientPublicLink, PublicLinkPurpose } from '../../../db/schema/client-public-links'
import { ClientPublicLinksRepository } from './client-public-links.repository'

export interface CreatePublicLinkOptions {
  expiresAt?: Date | null
  maxUses?: number | null
  metadata?: Record<string, unknown> | null
  force?: boolean // si true, revoca el activo y crea uno nuevo
}

export interface ValidatedPublicLink {
  id: string
  clientId: string
  purpose: PublicLinkPurpose
  metadata: Record<string, unknown> | null
}

/**
 * Service de tokens públicos. Cada cliente puede tener múltiples links
 * (uno por purpose). Idempotente: si se pide crear uno y ya existe activo
 * del mismo purpose, devuelve el existente. Para forzar uno nuevo (rotación
 * por filtración), se pasa `force: true`.
 *
 * `validateToken` corre la cadena de checks (existe, no revocado, no
 * expirado, max_uses no agotado, purpose match) y lanza el error apropiado.
 * Incrementa `use_count` y `last_used_at` antes de retornar.
 */
@Injectable()
export class ClientPublicLinksService {
  constructor(
    private readonly repo: ClientPublicLinksRepository,
    private readonly events: EventLogService,
  ) {}

  async createOrGet(
    clientId: string,
    purpose: PublicLinkPurpose,
    actorUserId: string,
    options: CreatePublicLinkOptions = {},
  ): Promise<ClientPublicLink> {
    if (!options.force) {
      const existing = await this.repo.findActiveByClientAndPurpose(clientId, purpose)
      if (existing) return existing
    } else {
      const existing = await this.repo.findActiveByClientAndPurpose(clientId, purpose)
      if (existing) await this.repo.revoke(existing.id)
    }

    const token = generateToken()
    const created = await this.repo.create({
      clientId,
      token,
      purpose,
      expiresAt: options.expiresAt ?? null,
      maxUses: options.maxUses ?? null,
      metadata: options.metadata ?? null,
      createdByUserId: actorUserId,
    })

    await this.events.log(
      'client_public_link.created',
      { clientId, purpose, linkId: created.id, force: options.force === true },
      actorUserId,
      { type: 'client', id: clientId },
    )

    return created
  }

  async validateToken(
    token: string,
    requiredPurpose: PublicLinkPurpose,
  ): Promise<ValidatedPublicLink> {
    const link = await this.repo.findByToken(token)
    if (!link) throw new PublicLinkInvalidError()
    if (link.revokedAt) throw new PublicLinkRevokedError()
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      throw new PublicLinkExpiredError()
    }
    if (link.maxUses !== null && link.useCount >= link.maxUses) {
      throw new PublicLinkExpiredError()
    }
    if (link.purpose !== requiredPurpose) throw new PublicLinkPurposeMismatchError()

    await this.repo.incrementUseCount(link.id)

    return {
      id: link.id,
      clientId: link.clientId,
      purpose: link.purpose,
      metadata: link.metadata as Record<string, unknown> | null,
    }
  }

  async revoke(linkId: string, actorUserId: string): Promise<void> {
    const link = await this.repo.findById(linkId)
    if (!link) throw new PublicLinkInvalidError()
    await this.repo.revoke(linkId)
    await this.events.log(
      'client_public_link.revoked',
      { clientId: link.clientId, linkId },
      actorUserId,
      { type: 'client', id: link.clientId },
    )
  }

  async listByClient(clientId: string): Promise<ClientPublicLink[]> {
    return this.repo.listByClient(clientId)
  }
}

function generateToken(): string {
  // 32 bytes hex = 64 chars. Suficientemente largo para no adivinarse por brute force.
  return randomBytes(32).toString('hex')
}
