import { BankCredentialsService } from '@plugins/bank-credentials/src/bank-credentials.service'
import {
  BankCredentialNotFoundError,
  BankPortalNotFoundError,
} from '@plugins/bank-credentials/src/bank-credentials.errors'
import type { BankCredentialsRepository } from '@plugins/bank-credentials/src/bank-credentials.repository'
import type { BankPortalsRepository } from '@plugins/bank-credentials/src/bank-portals.repository'
import type { EncryptionService } from '@/core/encryption/encryption.service'
import type { BankCredential } from '@plugins/bank-credentials/src/bank-credentials.schema'
import type { BankPortal } from '@plugins/bank-credentials/src/bank-portals.schema'

// Cifrado simulado con prefijo para poder verificar que SE aplicó (no es identidad).
const encryption = {
  encrypt: (s: string) => `E:${s}`,
  decrypt: (s: string) => (s.startsWith('E:') ? s.slice(2) : s),
} as EncryptionService

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

function cred(over: Partial<BankCredential> = {}): BankCredential {
  return {
    id: 'cr1',
    clientId: 'c1',
    bankPortalId: 'p1',
    nickname: null,
    usernameEncrypted: 'E:user',
    passwordEncrypted: 'E:pass',
    securityQaEncrypted: null,
    status: 'active',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }
}

function svc(
  repo: Partial<BankCredentialsRepository>,
  portals: Partial<BankPortalsRepository> = {},
): BankCredentialsService {
  return new BankCredentialsService(
    repo as BankCredentialsRepository,
    portals as BankPortalsRepository,
    encryption,
  )
}

describe('BankCredentialsService', () => {
  it('create lanza PORTAL_NOT_FOUND si el portal no existe', async () => {
    const s = svc({}, { findById: jest.fn().mockResolvedValue(null) })
    await expect(
      s.create({ clientId: 'c1', bankPortalId: 'pX', username: 'u', password: 'p' }),
    ).rejects.toBeInstanceOf(BankPortalNotFoundError)
  })

  it('create cifra los secretos antes de guardar y la respuesta nunca expone *_encrypted', async () => {
    const create = jest.fn().mockImplementation((data: Partial<BankCredential>) =>
      Promise.resolve(cred(data)),
    )
    const s = svc({ create }, { findById: jest.fn().mockResolvedValue(portal()) })

    const res = await s.create({ clientId: 'c1', bankPortalId: 'p1', username: 'user', password: 'pass' })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ usernameEncrypted: 'E:user', passwordEncrypted: 'E:pass' }),
    )
    expect(res.username).toBe('user')
    expect(res.password).toBe('pass')
    expect(res).not.toHaveProperty('usernameEncrypted')
    expect(res).not.toHaveProperty('passwordEncrypted')
  })

  it('getById descifra los secretos y trae el portal', async () => {
    const s = svc({
      findByIdWithPortal: jest.fn().mockResolvedValue({ credential: cred(), portal: portal() }),
    })
    const res = await s.getById('cr1')
    expect(res.username).toBe('user')
    expect(res.password).toBe('pass')
    expect(res.portal.name).toBe('Chase')
  })

  it('getById lanza NOT_FOUND si no existe', async () => {
    const s = svc({ findByIdWithPortal: jest.fn().mockResolvedValue(null) })
    await expect(s.getById('x')).rejects.toBeInstanceOf(BankCredentialNotFoundError)
  })

  it('update solo cifra el campo enviado', async () => {
    const update = jest.fn().mockResolvedValue(cred())
    const s = svc({
      findById: jest.fn().mockResolvedValue(cred()),
      update,
      findByIdWithPortal: jest
        .fn()
        .mockResolvedValue({ credential: cred({ passwordEncrypted: 'E:newpass' }), portal: portal() }),
    })
    const res = await s.update('cr1', { password: 'newpass' })
    expect(update).toHaveBeenCalledWith('cr1', { passwordEncrypted: 'E:newpass' })
    expect(res.password).toBe('newpass')
  })

  it('update lanza NOT_FOUND si no existe', async () => {
    const s = svc({ findById: jest.fn().mockResolvedValue(null) })
    await expect(s.update('x', { notes: 'n' })).rejects.toBeInstanceOf(BankCredentialNotFoundError)
  })

  it('delete lanza NOT_FOUND si no existe', async () => {
    const s = svc({ delete: jest.fn().mockResolvedValue(false) })
    await expect(s.delete('x')).rejects.toBeInstanceOf(BankCredentialNotFoundError)
  })

  it('list mapea y descifra cada fila', async () => {
    const s = svc({
      list: jest.fn().mockResolvedValue([{ credential: cred(), portal: portal() }]),
    })
    const res = await s.list({})
    expect(res).toHaveLength(1)
    expect(res[0]?.username).toBe('user')
    expect(res[0]).not.toHaveProperty('usernameEncrypted')
  })
})
