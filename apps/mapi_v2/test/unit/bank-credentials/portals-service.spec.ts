import { BankPortalsService } from '@plugins/bank-credentials/src/bank-portals.service'
import {
  BankPortalNameConflictError,
  BankPortalNotFoundError,
} from '@plugins/bank-credentials/src/bank-credentials.errors'
import type { BankPortalsRepository } from '@plugins/bank-credentials/src/bank-portals.repository'
import type { BankPortal } from '@plugins/bank-credentials/src/bank-portals.schema'

function portal(over: Partial<BankPortal> = {}): BankPortal {
  return {
    id: 'p1',
    name: 'Chase',
    portalUrl: 'https://chase.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }
}

function svc(repo: Partial<BankPortalsRepository>): BankPortalsService {
  return new BankPortalsService(repo as BankPortalsRepository)
}

describe('BankPortalsService', () => {
  it('create lanza NAME_CONFLICT si el nombre ya existe', async () => {
    const s = svc({ findByName: jest.fn().mockResolvedValue(portal()) })
    await expect(s.create({ name: 'Chase' })).rejects.toBeInstanceOf(BankPortalNameConflictError)
  })

  it('create inserta cuando el nombre está libre', async () => {
    const create = jest.fn().mockResolvedValue(portal())
    const s = svc({ findByName: jest.fn().mockResolvedValue(null), create })
    await s.create({ name: 'Chase', portalUrl: 'https://chase.com' })
    expect(create).toHaveBeenCalledWith({ name: 'Chase', portalUrl: 'https://chase.com' })
  })

  it('getById lanza NOT_FOUND si no existe', async () => {
    const s = svc({ findById: jest.fn().mockResolvedValue(null) })
    await expect(s.getById('x')).rejects.toBeInstanceOf(BankPortalNotFoundError)
  })
})
