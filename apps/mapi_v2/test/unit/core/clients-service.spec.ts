import { ClientsService } from '@/modules/11-clients/clients.service'
import { ClientNotFoundError } from '@/modules/11-clients/clients.errors'
import type { ClientsRepository } from '@/modules/11-clients/clients.repository'
import type { Client } from '@/core/db/schema/clients'
import type { CreateClientDto, ListClientsQuery, UpdateClientDto } from '@/modules/11-clients/dto/clients.dto'

const fakeClient = { id: 'c1', legalName: 'ACME' } as Client

function makeService(repo: Partial<ClientsRepository>): ClientsService {
  return new ClientsService(repo as ClientsRepository)
}

describe('ClientsService', () => {
  it('list delega al repo', async () => {
    const repo = { list: jest.fn().mockResolvedValue({ rows: [], total: 0 }) }
    const query: ListClientsQuery = { limit: 20, offset: 0 }
    await makeService(repo).list(query)
    expect(repo.list).toHaveBeenCalledWith(query)
  })

  it('getById devuelve el cliente cuando existe', async () => {
    const repo = { findById: jest.fn().mockResolvedValue(fakeClient) }
    await expect(makeService(repo).getById('c1')).resolves.toBe(fakeClient)
  })

  it('getById lanza CLIENT_NOT_FOUND cuando no existe', async () => {
    const repo = { findById: jest.fn().mockResolvedValue(null) }
    await expect(makeService(repo).getById('x')).rejects.toBeInstanceOf(ClientNotFoundError)
  })

  it('create delega al repo', async () => {
    const repo = { create: jest.fn().mockResolvedValue(fakeClient) }
    const dto: CreateClientDto = { legalName: 'ACME' }
    await expect(makeService(repo).create(dto)).resolves.toBe(fakeClient)
    expect(repo.create).toHaveBeenCalledWith(dto)
  })

  it('update devuelve el cliente actualizado', async () => {
    const repo = { update: jest.fn().mockResolvedValue(fakeClient) }
    const dto: UpdateClientDto = { legalName: 'ACME 2' }
    await expect(makeService(repo).update('c1', dto)).resolves.toBe(fakeClient)
  })

  it('update lanza CLIENT_NOT_FOUND cuando el repo no encuentra la fila', async () => {
    const repo = { update: jest.fn().mockResolvedValue(null) }
    await expect(makeService(repo).update('x', { legalName: 'Z' })).rejects.toBeInstanceOf(
      ClientNotFoundError,
    )
  })
})
