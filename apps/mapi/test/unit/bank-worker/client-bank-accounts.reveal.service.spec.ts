import { ClientBankAccountsService } from '../../../src/modules/22-bank-worker/client-bank-accounts.service'
import type { ClientBankAccountsRepository } from '../../../src/modules/22-bank-worker/client-bank-accounts.repository'
import type { GlobalCredentialRow } from '../../../src/modules/22-bank-worker/client-bank-accounts.repository'
import type { BankPortalsRepository } from '../../../src/modules/22-bank-worker/bank-portals.repository'
import type { EventLogService } from '../../../src/modules/95-event-log/event-log.service'
import { EncryptionService } from '../../../src/core/encryption/encryption.service'
import type { ClientBankAccount } from '../../../src/db/schema/client-bank-accounts'

/**
 * Tests Tipo A para v0.16.3 — credenciales descifradas en las respuestas.
 *
 * Cobertura:
 * - CR-bw-001: list() descifra username/password.
 * - CR-bw-002: findById() descifra username/password/security_qa.
 * - CR-bw-003: security_qa = null cuando no se capturó.
 * - CR-bw-004: listGlobal() descifra las credenciales en los joins.
 */

const NOW = new Date()
// Llave AES-256-GCM válida (32 bytes) para round-trip real encrypt→decrypt.
const encryption = new EncryptionService(Buffer.alloc(32, 1).toString('base64'))

function buildRow(overrides: Partial<ClientBankAccount> = {}): ClientBankAccount {
  return {
    id: 'cred-1',
    clientId: 'client-1',
    bankPortalId: 'portal-1',
    usernameEncrypted: encryption.encrypt('alfredo.user'),
    passwordEncrypted: encryption.encrypt('S3cret!Pass'),
    securityQaEncrypted: encryption.encrypt('mascota: Firulais'),
    status: 'active',
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

interface Mocks {
  repo: jest.Mocked<ClientBankAccountsRepository>
  portalsRepo: jest.Mocked<BankPortalsRepository>
  events: { log: jest.Mock }
}

function makeMocks(): Mocks {
  return {
    repo: {
      listByClient: jest.fn(),
      findById: jest.fn(),
      listGlobalWithJoins: jest.fn(),
    } as unknown as jest.Mocked<ClientBankAccountsRepository>,
    portalsRepo: {} as unknown as jest.Mocked<BankPortalsRepository>,
    events: { log: jest.fn().mockResolvedValue(undefined) },
  }
}

function buildService(m: Mocks): ClientBankAccountsService {
  return new ClientBankAccountsService(
    m.repo,
    m.portalsRepo,
    m.events as unknown as EventLogService,
    encryption,
  )
}

describe('ClientBankAccountsService — reveal (v0.16.3)', () => {
  it('CR-bw-001: list() descifra username y password', async () => {
    const m = makeMocks()
    m.repo.listByClient.mockResolvedValue([buildRow()])
    const svc = buildService(m)

    const [cred] = await svc.list('client-1')

    expect(cred.username).toBe('alfredo.user')
    expect(cred.password).toBe('S3cret!Pass')
  })

  it('CR-bw-002: findById() descifra username/password/security_qa', async () => {
    const m = makeMocks()
    m.repo.findById.mockResolvedValue(buildRow())
    const svc = buildService(m)

    const cred = await svc.findById('cred-1', 'client-1')

    expect(cred.username).toBe('alfredo.user')
    expect(cred.password).toBe('S3cret!Pass')
    expect(cred.security_qa).toBe('mascota: Firulais')
  })

  it('CR-bw-003: security_qa = null cuando no se capturó', async () => {
    const m = makeMocks()
    m.repo.findById.mockResolvedValue(buildRow({ securityQaEncrypted: null }))
    const svc = buildService(m)

    const cred = await svc.findById('cred-1', 'client-1')

    expect(cred.security_qa).toBeNull()
    expect(cred.password).toBe('S3cret!Pass')
  })

  it('CR-bw-004: listGlobal() descifra las credenciales en los joins', async () => {
    const m = makeMocks()
    const globalRow: GlobalCredentialRow = {
      credential: buildRow(),
      client: { id: 'client-1', legal_name: 'Bilia Eatery' },
      portal: { id: 'portal-1', name: 'Chase', portal_url: null },
    }
    m.repo.listGlobalWithJoins.mockResolvedValue({ items: [globalRow], total: 1 })
    const svc = buildService(m)

    const result = await svc.listGlobal({ limit: 200, offset: 0 })

    expect(result.items[0].username).toBe('alfredo.user')
    expect(result.items[0].password).toBe('S3cret!Pass')
    expect(result.items[0].security_qa).toBe('mascota: Firulais')
  })
})
