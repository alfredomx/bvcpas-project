import { Injectable } from '@nestjs/common'
import type { Client } from '@/core/db/schema/clients'
import { ClientsRepository } from './clients.repository'
import { ClientNotFoundError } from './clients.errors'
import type { CreateClientDto, ListClientsQuery, UpdateClientDto } from './dto/clients.dto'

/**
 * API pública de clientes. Es lo que inyectan los plugins (intuit, uncats, …)
 * para leer/usar clientes sin tocar la tabla. Exportado por `ClientsModule`.
 */
@Injectable()
export class ClientsService {
  constructor(private readonly repo: ClientsRepository) {}

  list(query: ListClientsQuery): Promise<{ rows: Client[]; total: number }> {
    return this.repo.list(query)
  }

  async getById(id: string): Promise<Client> {
    const client = await this.repo.findById(id)
    if (!client) throw new ClientNotFoundError(id)
    return client
  }

  create(data: CreateClientDto): Promise<Client> {
    return this.repo.create(data)
  }

  async update(id: string, data: UpdateClientDto): Promise<Client> {
    const updated = await this.repo.update(id, data)
    if (!updated) throw new ClientNotFoundError(id)
    return updated
  }
}
