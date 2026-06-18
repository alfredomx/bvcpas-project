import { BankCredentialsPortAdapter } from '@plugins/bank-credentials/src/bank-credentials.port'
import { BankCredentialNotFoundError } from '@plugins/bank-credentials/src/bank-credentials.errors'
import type { BankCredentialsRepository } from '@plugins/bank-credentials/src/bank-credentials.repository'
import type { EncryptionService } from '@/core/encryption/encryption.service'

const encryption = {
  encrypt: (s: string) => `E:${s}`,
  decrypt: (s: string) => (s.startsWith('E:') ? s.slice(2) : s),
} as EncryptionService

function adapter(repo: Partial<BankCredentialsRepository>): BankCredentialsPortAdapter {
  return new BankCredentialsPortAdapter(repo as BankCredentialsRepository, encryption)
}

function row() {
  return {
    credential: {
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
    },
    portal: { id: 'p1', name: 'Chase', portalUrl: null, createdAt: new Date(), updatedAt: new Date() },
  }
}

describe('BankCredentialsPortAdapter', () => {
  it('getDecrypted descifra los secretos y adjunta el portalName', async () => {
    const a = adapter({ findByIdWithPortal: jest.fn().mockResolvedValue(row()) })
    const res = await a.getDecrypted('cr1')
    expect(res).toEqual({
      id: 'cr1',
      clientId: 'c1',
      bankPortalId: 'p1',
      portalName: 'Chase',
      username: 'user',
      password: 'pass',
      securityQa: null,
      status: 'active',
    })
  })

  it('getDecrypted lanza NOT_FOUND si no existe', async () => {
    const a = adapter({ findByIdWithPortal: jest.fn().mockResolvedValue(null) })
    await expect(a.getDecrypted('x')).rejects.toBeInstanceOf(BankCredentialNotFoundError)
  })
})
