import { MicrosoftTokensService } from '../../../src/modules/21-microsoft-oauth/tokens/microsoft-tokens.service'
import type { MicrosoftTokensRepository } from '../../../src/modules/21-microsoft-oauth/tokens/microsoft-tokens.repository'
import type { EncryptionService } from '../../../src/core/encryption/encryption.service'
import { MicrosoftTokensNotFoundError } from '../../../src/modules/21-microsoft-oauth/microsoft-oauth.errors'
import type { UserMicrosoftToken } from '../../../src/db/schema/user-microsoft-tokens'

/**
 * Tests Tipo A para MicrosoftTokensService. Sin DB ni red.
 *
 * Cobertura:
 * - CR-msft-001: upsert cifra access + refresh con EncryptionService antes de persistir.
 * - CR-msft-002: getDecryptedByUserId descifra y devuelve plaintext.
 * - CR-msft-003: getDecryptedByUserId lanza MicrosoftTokensNotFoundError si no hay row.
 * - CR-msft-004: deleteByUserId borra row del repo.
 */

const NOW = new Date('2026-05-05T12:00:00Z')
const FUTURE = new Date(NOW.getTime() + 60 * 60 * 1000)

function buildToken(overrides: Partial<UserMicrosoftToken> = {}): UserMicrosoftToken {
  return {
    userId: 'user-1',
    microsoftUserId: 'msft-uid-abc',
    email: 'bob@example.com',
    scopes: 'Mail.Send Mail.ReadWrite User.Read offline_access',
    accessTokenEncrypted: 'enc:access-plain',
    refreshTokenEncrypted: 'enc:refresh-plain',
    accessTokenExpiresAt: FUTURE,
    lastRefreshedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

interface Mocks {
  repo: jest.Mocked<MicrosoftTokensRepository>
  enc: jest.Mocked<EncryptionService>
}

function makeMocks(): Mocks {
  const repo = {
    findByUserId: jest.fn(),
    upsert: jest.fn(),
    deleteByUserId: jest.fn(),
    updateRefreshed: jest.fn(),
  } as unknown as jest.Mocked<MicrosoftTokensRepository>

  const enc = {
    encrypt: jest.fn((s: string) => `enc:${s}`),
    decrypt: jest.fn((s: string) => s.replace(/^enc:/, '')),
  } as unknown as jest.Mocked<EncryptionService>

  return { repo, enc }
}

function buildService(m: Mocks): MicrosoftTokensService {
  return new MicrosoftTokensService(m.repo, m.enc)
}

describe('MicrosoftTokensService', () => {
  describe('CR-msft-001 — upsert cifra antes de persistir', () => {
    it('llama encrypt para access y refresh y guarda los ciphertexts', async () => {
      const m = makeMocks()
      const svc = buildService(m)

      await svc.upsert({
        userId: 'user-1',
        microsoftUserId: 'msft-uid-abc',
        email: 'bob@example.com',
        scopes: 'Mail.Send offline_access',
        accessToken: 'access-plain',
        refreshToken: 'refresh-plain',
        accessTokenExpiresAt: FUTURE,
      })

      expect(m.enc.encrypt).toHaveBeenCalledWith('access-plain')
      expect(m.enc.encrypt).toHaveBeenCalledWith('refresh-plain')
      expect(m.repo.upsert).toHaveBeenCalledTimes(1)
      const saved = m.repo.upsert.mock.calls[0]?.[0]
      expect(saved).toMatchObject({
        userId: 'user-1',
        microsoftUserId: 'msft-uid-abc',
        email: 'bob@example.com',
        scopes: 'Mail.Send offline_access',
        accessTokenEncrypted: 'enc:access-plain',
        refreshTokenEncrypted: 'enc:refresh-plain',
        accessTokenExpiresAt: FUTURE,
      })
    })
  })

  describe('CR-msft-002 — getDecryptedByUserId descifra', () => {
    it('devuelve plaintext en memoria', async () => {
      const m = makeMocks()
      m.repo.findByUserId.mockResolvedValueOnce(buildToken())
      const svc = buildService(m)

      const result = await svc.getDecryptedByUserId('user-1')

      expect(result).toEqual({
        userId: 'user-1',
        microsoftUserId: 'msft-uid-abc',
        email: 'bob@example.com',
        scopes: 'Mail.Send Mail.ReadWrite User.Read offline_access',
        accessToken: 'access-plain',
        refreshToken: 'refresh-plain',
        accessTokenExpiresAt: FUTURE,
      })
      expect(m.enc.decrypt).toHaveBeenCalledWith('enc:access-plain')
      expect(m.enc.decrypt).toHaveBeenCalledWith('enc:refresh-plain')
    })
  })

  describe('CR-msft-003 — getDecryptedByUserId sin row', () => {
    it('lanza MicrosoftTokensNotFoundError', async () => {
      const m = makeMocks()
      m.repo.findByUserId.mockResolvedValueOnce(null)
      const svc = buildService(m)

      await expect(svc.getDecryptedByUserId('user-x')).rejects.toBeInstanceOf(
        MicrosoftTokensNotFoundError,
      )
    })
  })

  describe('CR-msft-004 — deleteByUserId', () => {
    it('borra row del repo', async () => {
      const m = makeMocks()
      const svc = buildService(m)

      await svc.deleteByUserId('user-1')

      expect(m.repo.deleteByUserId).toHaveBeenCalledWith('user-1')
    })
  })
})
