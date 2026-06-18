import { BankAccountsService } from '@plugins/bank-credentials/src/bank-accounts.service'
import {
  BankAccountMaskConflictError,
  BankAccountNotFoundError,
  BankCredentialNotFoundError,
} from '@plugins/bank-credentials/src/bank-credentials.errors'
import type { BankAccountsRepository } from '@plugins/bank-credentials/src/bank-accounts.repository'
import type { BankCredentialsRepository } from '@plugins/bank-credentials/src/bank-credentials.repository'
import type { BankAccount } from '@plugins/bank-credentials/src/bank-accounts.schema'

function acct(over: Partial<BankAccount> = {}): BankAccount {
  return {
    id: 'a1',
    bankCredentialId: 'cr1',
    accountMask: '1234',
    accountType: 'checking',
    label: null,
    status: 'active',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }
}

// Por default el login existe; cada test puede sobreescribir `creds`.
function svc(
  repo: Partial<BankAccountsRepository>,
  creds: Partial<BankCredentialsRepository> = { findById: jest.fn().mockResolvedValue({ id: 'cr1' }) },
): BankAccountsService {
  return new BankAccountsService(repo as BankAccountsRepository, creds as BankCredentialsRepository)
}

describe('BankAccountsService', () => {
  it('create lanza CREDENTIAL_NOT_FOUND si el login no existe', async () => {
    const s = svc({}, { findById: jest.fn().mockResolvedValue(null) })
    await expect(
      s.create({ bankCredentialId: 'x', accountMask: '1234', accountType: 'checking' }),
    ).rejects.toBeInstanceOf(BankCredentialNotFoundError)
  })

  it('create lanza MASK_CONFLICT si el mask ya existe en el login', async () => {
    const s = svc({ findByCredentialAndMask: jest.fn().mockResolvedValue(acct()) })
    await expect(
      s.create({ bankCredentialId: 'cr1', accountMask: '1234', accountType: 'checking' }),
    ).rejects.toBeInstanceOf(BankAccountMaskConflictError)
  })

  it('create inserta cuando no hay duplicado', async () => {
    const create = jest.fn().mockResolvedValue(acct())
    const s = svc({ findByCredentialAndMask: jest.fn().mockResolvedValue(null), create })
    await s.create({ bankCredentialId: 'cr1', accountMask: '1234', accountType: 'checking' })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        bankCredentialId: 'cr1',
        accountMask: '1234',
        accountType: 'checking',
        status: 'active',
      }),
    )
  })

  it('listByCredential valida que el login exista', async () => {
    const s = svc(
      { listByCredential: jest.fn().mockResolvedValue([]) },
      { findById: jest.fn().mockResolvedValue(null) },
    )
    await expect(s.listByCredential('x')).rejects.toBeInstanceOf(BankCredentialNotFoundError)
  })

  it('getById lanza NOT_FOUND si no existe', async () => {
    const s = svc({ findById: jest.fn().mockResolvedValue(null) })
    await expect(s.getById('x')).rejects.toBeInstanceOf(BankAccountNotFoundError)
  })

  it('delete lanza NOT_FOUND si no existe', async () => {
    const s = svc({ delete: jest.fn().mockResolvedValue(false) })
    await expect(s.delete('x')).rejects.toBeInstanceOf(BankAccountNotFoundError)
  })
})
