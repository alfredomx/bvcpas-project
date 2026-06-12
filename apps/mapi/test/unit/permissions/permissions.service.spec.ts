import type Redis from 'ioredis'
import {
  PermissionsService,
  RoleNameConflictError,
  RoleNotFoundError,
  SystemRoleNotEditableError,
  PermissionNotFoundError,
  UserRoleAlreadyAssignedError,
  UserMustHaveAtLeastOneRoleError,
} from '../../../src/core/permissions/permissions.service'
import type { PermissionsRepository } from '../../../src/core/permissions/permissions.repository'
import {
  SYSTEM_ROLE_IDS,
  type UserPermissionsRawData,
} from '../../../src/core/permissions/permissions.repository'

/**
 * Tests Tipo A — PermissionsService.
 *
 * Cobertura:
 * - getEffectivePermissionCodes: cache hit, cache miss + populate.
 * - computeEffectivePermissionCodes: roles, grant override agrega,
 *   deny override quita, wildcards en grant se expanden, denies ganan
 *   sobre grants.
 * - getEffectivePermissions devuelve {roles, permissions}.
 * - CRUD roles + reglas de sistema (system role no editable/eliminable).
 * - assignRoleToUser + revokeRoleFromUser + regla del último rol.
 * - setUserPermissionOverride + reglas (permission must exist, no
 *   duplicate override).
 * - Cache invalidation cuando aplica.
 */

interface Mocks {
  repo: jest.Mocked<PermissionsRepository>
  redis: jest.Mocked<Redis>
}

function makeMocks(): Mocks {
  const repo = {
    findAllRoles: jest.fn(),
    findRoleById: jest.fn(),
    findRoleByName: jest.fn(),
    createRole: jest.fn(),
    updateRole: jest.fn(),
    deleteRole: jest.fn(),
    findAllPermissions: jest.fn(),
    findPermissionByCode: jest.fn(),
    findPermissionsByCodes: jest.fn(),
    findPermissionCodesByRoleId: jest.fn(),
    grantPermissionsToRole: jest.fn(),
    revokePermissionFromRole: jest.fn(),
    findUserIdsByRoleId: jest.fn(),
    findRolesByUserId: jest.fn(),
    findUserRole: jest.fn(),
    assignRoleToUser: jest.fn(),
    revokeRoleFromUser: jest.fn(),
    countUserRoles: jest.fn(),
    findUserOverridesByUserId: jest.fn(),
    findUserOverride: jest.fn(),
    grantOrDenyOverride: jest.fn(),
    deleteUserOverride: jest.fn(),
    getUserPermissionsRawData: jest.fn(),
  } as unknown as jest.Mocked<PermissionsRepository>

  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  } as unknown as jest.Mocked<Redis>

  return { repo, redis }
}

const NOW = new Date('2026-06-12T12:00:00Z')

function buildRole(overrides: Partial<{ id: string; name: string; isSystem: boolean }> = {}) {
  return {
    id: overrides.id ?? 'role-1',
    name: overrides.name ?? 'Custom',
    description: null,
    isSystem: overrides.isSystem ?? false,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

describe('PermissionsService', () => {
  // ════════════════════════════════════════════════════════════════
  // getEffectivePermissionCodes — cache
  // ════════════════════════════════════════════════════════════════

  describe('getEffectivePermissionCodes (cache)', () => {
    it('cache hit: devuelve sin tocar DB', async () => {
      const m = makeMocks()
      m.redis.get.mockResolvedValueOnce(JSON.stringify(['banking.read', 'banking.update']))
      const svc = new PermissionsService(m.repo, m.redis)

      const codes = await svc.getEffectivePermissionCodes('u1')

      expect(codes).toEqual(['banking.read', 'banking.update'])
      expect(m.redis.get).toHaveBeenCalledWith('user:permissions:u1')
      expect(m.repo.getUserPermissionsRawData).not.toHaveBeenCalled()
      expect(m.redis.set).not.toHaveBeenCalled()
    })

    it('cache miss: calcula desde DB y popula con TTL 900s', async () => {
      const m = makeMocks()
      m.redis.get.mockResolvedValueOnce(null)
      m.repo.getUserPermissionsRawData.mockResolvedValueOnce({
        roleIds: ['r1'],
        rolePermissionCodes: ['banking.read'],
        userOverrides: [],
      })
      const svc = new PermissionsService(m.repo, m.redis)

      const codes = await svc.getEffectivePermissionCodes('u1')

      expect(codes).toEqual(['banking.read'])
      expect(m.redis.set).toHaveBeenCalledWith(
        'user:permissions:u1',
        JSON.stringify(['banking.read']),
        'EX',
        15 * 60,
      )
    })

    it('cache JSON corrupto: recalcula desde DB sin lanzar', async () => {
      const m = makeMocks()
      m.redis.get.mockResolvedValueOnce('{not valid json')
      m.repo.getUserPermissionsRawData.mockResolvedValueOnce({
        roleIds: ['r1'],
        rolePermissionCodes: ['clients.read'],
        userOverrides: [],
      })
      const svc = new PermissionsService(m.repo, m.redis)

      const codes = await svc.getEffectivePermissionCodes('u1')

      expect(codes).toEqual(['clients.read'])
      expect(m.repo.getUserPermissionsRawData).toHaveBeenCalledWith('u1')
    })
  })

  // ════════════════════════════════════════════════════════════════
  // Cómputo de permisos efectivos
  // ════════════════════════════════════════════════════════════════

  describe('cómputo de permisos efectivos', () => {
    function setupSvc(raw: UserPermissionsRawData): {
      svc: PermissionsService
      m: Mocks
    } {
      const m = makeMocks()
      m.redis.get.mockResolvedValue(null)
      m.repo.getUserPermissionsRawData.mockResolvedValue(raw)
      const svc = new PermissionsService(m.repo, m.redis)
      return { svc, m }
    }

    it('roles literales se devuelven tal cual', async () => {
      const { svc } = setupSvc({
        roleIds: ['r1'],
        rolePermissionCodes: ['banking.read', 'banking.update'],
        userOverrides: [],
      })
      const codes = await svc.getEffectivePermissionCodes('u1')
      expect(new Set(codes)).toEqual(new Set(['banking.read', 'banking.update']))
    })

    it('override grant agrega permiso', async () => {
      const { svc } = setupSvc({
        roleIds: ['r1'],
        rolePermissionCodes: ['banking.read', 'banking.update'],
        userOverrides: [{ permissionCode: 'banking.delete', granted: true }],
      })
      const codes = await svc.getEffectivePermissionCodes('u1')
      expect(new Set(codes)).toEqual(new Set(['banking.read', 'banking.update', 'banking.delete']))
    })

    it('override deny quita permiso heredado del rol', async () => {
      const { svc } = setupSvc({
        roleIds: ['r1'],
        rolePermissionCodes: ['banking.read', 'banking.update', 'banking.create'],
        userOverrides: [{ permissionCode: 'banking.create', granted: false }],
      })
      const codes = await svc.getEffectivePermissionCodes('u1')
      expect(new Set(codes)).toEqual(new Set(['banking.read', 'banking.update']))
    })

    it('deny gana sobre grant si ambos están presentes', async () => {
      // El usuario tiene un grant del rol que también está en deny override.
      const { svc } = setupSvc({
        roleIds: ['r1'],
        rolePermissionCodes: ['banking.delete'],
        userOverrides: [{ permissionCode: 'banking.delete', granted: false }],
      })
      const codes = await svc.getEffectivePermissionCodes('u1')
      expect(codes).not.toContain('banking.delete')
    })

    it('caso Lorena vs Ileana: misma raíz, distinto resultado por overrides', async () => {
      // Lorena: rol Bookkeeper (read+create+update) + grant `banking.delete`.
      const lorena = setupSvc({
        roleIds: ['bookkeeper'],
        rolePermissionCodes: ['banking.read', 'banking.create', 'banking.update'],
        userOverrides: [{ permissionCode: 'banking.delete', granted: true }],
      })
      const codesLorena = await lorena.svc.getEffectivePermissionCodes('lorena')
      expect(codesLorena).toContain('banking.delete')

      // Ileana: mismo rol Bookkeeper, sin overrides.
      const ileana = setupSvc({
        roleIds: ['bookkeeper'],
        rolePermissionCodes: ['banking.read', 'banking.create', 'banking.update'],
        userOverrides: [],
      })
      const codesIleana = await ileana.svc.getEffectivePermissionCodes('ileana')
      expect(codesIleana).not.toContain('banking.delete')
    })

    it('codes retornados son ordenados alfabéticamente', async () => {
      const { svc } = setupSvc({
        roleIds: ['r1'],
        rolePermissionCodes: ['intuit.update', 'banking.read', 'clients.create'],
        userOverrides: [],
      })
      const codes = await svc.getEffectivePermissionCodes('u1')
      // Verificar orden:
      const sorted = [...codes].sort()
      expect(codes).toEqual(sorted)
    })
  })

  // ════════════════════════════════════════════════════════════════
  // getEffectivePermissions (con roles)
  // ════════════════════════════════════════════════════════════════

  describe('getEffectivePermissions', () => {
    it('devuelve roles + permisos efectivos', async () => {
      const m = makeMocks()
      m.redis.get.mockResolvedValueOnce(JSON.stringify(['banking.read']))
      const role = buildRole({ id: 'r1', name: 'Bookkeeper' })
      m.repo.findRolesByUserId.mockResolvedValueOnce([role])
      const svc = new PermissionsService(m.repo, m.redis)

      const result = await svc.getEffectivePermissions('u1')

      expect(result.roles).toEqual([role])
      expect(result.permissions).toEqual(['banking.read'])
    })
  })

  // ════════════════════════════════════════════════════════════════
  // CRUD roles
  // ════════════════════════════════════════════════════════════════

  describe('CRUD roles', () => {
    it('createRole con nombre nuevo crea y devuelve', async () => {
      const m = makeMocks()
      m.repo.findRoleByName.mockResolvedValueOnce(null)
      const created = buildRole({ id: 'r-new', name: 'Bookkeeper' })
      m.repo.createRole.mockResolvedValueOnce(created)
      const svc = new PermissionsService(m.repo, m.redis)

      const result = await svc.createRole({ name: 'Bookkeeper', description: null })

      expect(result).toEqual(created)
      expect(m.repo.createRole).toHaveBeenCalledWith({
        name: 'Bookkeeper',
        description: null,
        isSystem: false,
      })
    })

    it('createRole con nombre existente → RoleNameConflictError', async () => {
      const m = makeMocks()
      m.repo.findRoleByName.mockResolvedValueOnce(buildRole({ name: 'Bookkeeper' }))
      const svc = new PermissionsService(m.repo, m.redis)

      await expect(svc.createRole({ name: 'Bookkeeper' })).rejects.toBeInstanceOf(
        RoleNameConflictError,
      )
      expect(m.repo.createRole).not.toHaveBeenCalled()
    })

    it('updateRole en rol del sistema → SystemRoleNotEditableError', async () => {
      const m = makeMocks()
      m.repo.findRoleById.mockResolvedValueOnce(
        buildRole({ id: SYSTEM_ROLE_IDS.ADMINISTRATOR, name: 'Administrator', isSystem: true }),
      )
      const svc = new PermissionsService(m.repo, m.redis)

      await expect(
        svc.updateRole(SYSTEM_ROLE_IDS.ADMINISTRATOR, { name: 'Otro' }),
      ).rejects.toBeInstanceOf(SystemRoleNotEditableError)
      expect(m.repo.updateRole).not.toHaveBeenCalled()
    })

    it('deleteRole en rol del sistema → SystemRoleNotEditableError', async () => {
      const m = makeMocks()
      m.repo.findRoleById.mockResolvedValueOnce(
        buildRole({ id: SYSTEM_ROLE_IDS.VIEWER, name: 'Viewer', isSystem: true }),
      )
      const svc = new PermissionsService(m.repo, m.redis)

      await expect(svc.deleteRole(SYSTEM_ROLE_IDS.VIEWER)).rejects.toBeInstanceOf(
        SystemRoleNotEditableError,
      )
      expect(m.repo.deleteRole).not.toHaveBeenCalled()
    })

    it('getRoleById con id inexistente → RoleNotFoundError', async () => {
      const m = makeMocks()
      m.repo.findRoleById.mockResolvedValueOnce(null)
      const svc = new PermissionsService(m.repo, m.redis)

      await expect(svc.getRoleById('not-existing')).rejects.toBeInstanceOf(RoleNotFoundError)
    })

    it('updateRole exitoso invalida cache de usuarios con ese rol', async () => {
      const m = makeMocks()
      const role = buildRole({ id: 'r-1', isSystem: false })
      m.repo.findRoleById.mockResolvedValueOnce(role)
      m.repo.updateRole.mockResolvedValueOnce({ ...role, description: 'updated' })
      m.repo.findUserIdsByRoleId.mockResolvedValueOnce(['u1', 'u2'])
      const svc = new PermissionsService(m.repo, m.redis)

      await svc.updateRole('r-1', { description: 'updated' })

      expect(m.redis.del).toHaveBeenCalledWith('user:permissions:u1', 'user:permissions:u2')
    })
  })

  // ════════════════════════════════════════════════════════════════
  // Permisos del rol
  // ════════════════════════════════════════════════════════════════

  describe('permisos del rol', () => {
    it('grantPermissionsToRole valida codes + asigna + invalida cache', async () => {
      const m = makeMocks()
      const role = buildRole({ id: 'r-1', isSystem: false })
      m.repo.findRoleById.mockResolvedValueOnce(role)
      // permissions.repository.findPermissionsByCodes devuelve los Permission rows.
      m.repo.findPermissionsByCodes.mockResolvedValueOnce([
        {
          id: 'p1',
          code: 'banking.read',
          description: '',
          module: 'banking',
          createdAt: NOW,
        },
      ])
      m.repo.findUserIdsByRoleId.mockResolvedValueOnce(['u1'])
      const svc = new PermissionsService(m.repo, m.redis)

      await svc.grantPermissionsToRole('r-1', ['banking.read'], 'actor-1')

      expect(m.repo.grantPermissionsToRole).toHaveBeenCalledWith('r-1', ['p1'], 'actor-1')
      expect(m.redis.del).toHaveBeenCalledWith('user:permissions:u1')
    })

    it('grantPermissionsToRole con code inválido → PermissionNotFoundError', async () => {
      const m = makeMocks()
      const role = buildRole({ id: 'r-1', isSystem: false })
      m.repo.findRoleById.mockResolvedValueOnce(role)
      const svc = new PermissionsService(m.repo, m.redis)

      await expect(
        svc.grantPermissionsToRole('r-1', ['not.a.real.code'], 'actor-1'),
      ).rejects.toBeInstanceOf(PermissionNotFoundError)
      expect(m.repo.grantPermissionsToRole).not.toHaveBeenCalled()
    })

    it('grantPermissionsToRole en rol del sistema → SystemRoleNotEditableError', async () => {
      const m = makeMocks()
      m.repo.findRoleById.mockResolvedValueOnce(
        buildRole({ id: SYSTEM_ROLE_IDS.ADMINISTRATOR, name: 'Administrator', isSystem: true }),
      )
      const svc = new PermissionsService(m.repo, m.redis)

      await expect(
        svc.grantPermissionsToRole(SYSTEM_ROLE_IDS.ADMINISTRATOR, ['banking.read'], 'actor-1'),
      ).rejects.toBeInstanceOf(SystemRoleNotEditableError)
    })
  })

  // ════════════════════════════════════════════════════════════════
  // Asignación de roles a usuarios
  // ════════════════════════════════════════════════════════════════

  describe('asignación de roles a usuarios', () => {
    it('assignRoleToUser exitoso invalida cache del user', async () => {
      const m = makeMocks()
      m.repo.findRoleById.mockResolvedValueOnce(buildRole({ id: 'r-1' }))
      m.repo.findUserRole.mockResolvedValueOnce(null)
      const svc = new PermissionsService(m.repo, m.redis)

      await svc.assignRoleToUser('u1', 'r-1', 'actor-1')

      expect(m.repo.assignRoleToUser).toHaveBeenCalledWith('u1', 'r-1', 'actor-1')
      expect(m.redis.del).toHaveBeenCalledWith('user:permissions:u1')
    })

    it('assignRoleToUser cuando ya está asignado → UserRoleAlreadyAssignedError', async () => {
      const m = makeMocks()
      m.repo.findRoleById.mockResolvedValueOnce(buildRole({ id: 'r-1' }))
      m.repo.findUserRole.mockResolvedValueOnce({
        userId: 'u1',
        roleId: 'r-1',
        grantedAt: NOW,
        grantedBy: null,
      })
      const svc = new PermissionsService(m.repo, m.redis)

      await expect(svc.assignRoleToUser('u1', 'r-1', 'actor-1')).rejects.toBeInstanceOf(
        UserRoleAlreadyAssignedError,
      )
      expect(m.repo.assignRoleToUser).not.toHaveBeenCalled()
    })

    it('revokeRoleFromUser del último rol → UserMustHaveAtLeastOneRoleError', async () => {
      const m = makeMocks()
      m.repo.countUserRoles.mockResolvedValueOnce(1)
      const svc = new PermissionsService(m.repo, m.redis)

      await expect(svc.revokeRoleFromUser('u1', 'r-1')).rejects.toBeInstanceOf(
        UserMustHaveAtLeastOneRoleError,
      )
      expect(m.repo.revokeRoleFromUser).not.toHaveBeenCalled()
    })

    it('revokeRoleFromUser cuando tiene 2+ roles funciona', async () => {
      const m = makeMocks()
      m.repo.countUserRoles.mockResolvedValueOnce(2)
      const svc = new PermissionsService(m.repo, m.redis)

      await svc.revokeRoleFromUser('u1', 'r-1')

      expect(m.repo.revokeRoleFromUser).toHaveBeenCalledWith('u1', 'r-1')
      expect(m.redis.del).toHaveBeenCalledWith('user:permissions:u1')
    })
  })

  // ════════════════════════════════════════════════════════════════
  // Overrides individuales
  // ════════════════════════════════════════════════════════════════

  describe('overrides individuales', () => {
    it('setUserPermissionOverride exitoso (grant=true)', async () => {
      const m = makeMocks()
      m.repo.findPermissionByCode.mockResolvedValueOnce({
        id: 'p1',
        code: 'banking.delete',
        description: '',
        module: 'banking',
        createdAt: NOW,
      })
      m.repo.findUserOverride.mockResolvedValueOnce(null)
      const svc = new PermissionsService(m.repo, m.redis)

      await svc.setUserPermissionOverride({
        userId: 'lorena',
        permissionCode: 'banking.delete',
        granted: true,
        reason: 'Autorizada por Alfredo',
        grantedBy: 'actor-1',
      })

      expect(m.repo.grantOrDenyOverride).toHaveBeenCalledWith({
        userId: 'lorena',
        permissionId: 'p1',
        granted: true,
        reason: 'Autorizada por Alfredo',
        grantedBy: 'actor-1',
      })
      expect(m.redis.del).toHaveBeenCalledWith('user:permissions:lorena')
    })

    it('setUserPermissionOverride con code inválido → PermissionNotFoundError', async () => {
      const m = makeMocks()
      m.repo.findPermissionByCode.mockResolvedValueOnce(null)
      const svc = new PermissionsService(m.repo, m.redis)

      await expect(
        svc.setUserPermissionOverride({
          userId: 'u1',
          permissionCode: 'not.a.real.code',
          granted: true,
          reason: null,
          grantedBy: 'actor-1',
        }),
      ).rejects.toBeInstanceOf(PermissionNotFoundError)
    })

    it('removeUserPermissionOverride invalida cache solo si elimina algo', async () => {
      const m = makeMocks()
      m.repo.findPermissionByCode.mockResolvedValueOnce({
        id: 'p1',
        code: 'banking.delete',
        description: '',
        module: 'banking',
        createdAt: NOW,
      })
      m.repo.deleteUserOverride.mockResolvedValueOnce(true)
      const svc = new PermissionsService(m.repo, m.redis)

      const result = await svc.removeUserPermissionOverride('lorena', 'banking.delete')

      expect(result).toBe(true)
      expect(m.redis.del).toHaveBeenCalledWith('user:permissions:lorena')
    })

    it('removeUserPermissionOverride si no había override → no invalida cache', async () => {
      const m = makeMocks()
      m.repo.findPermissionByCode.mockResolvedValueOnce({
        id: 'p1',
        code: 'banking.delete',
        description: '',
        module: 'banking',
        createdAt: NOW,
      })
      m.repo.deleteUserOverride.mockResolvedValueOnce(false)
      const svc = new PermissionsService(m.repo, m.redis)

      const result = await svc.removeUserPermissionOverride('u1', 'banking.delete')

      expect(result).toBe(false)
      expect(m.redis.del).not.toHaveBeenCalled()
    })
  })

  // ════════════════════════════════════════════════════════════════
  // Catálogo
  // ════════════════════════════════════════════════════════════════

  describe('catálogo', () => {
    it('listPermissionsGrouped agrupa por module', async () => {
      const m = makeMocks()
      m.repo.findAllPermissions.mockResolvedValueOnce([
        { id: 'p1', code: 'banking.read', description: '', module: 'banking', createdAt: NOW },
        {
          id: 'p2',
          code: 'banking.update',
          description: '',
          module: 'banking',
          createdAt: NOW,
        },
        { id: 'p3', code: 'clients.read', description: '', module: 'clients', createdAt: NOW },
      ])
      const svc = new PermissionsService(m.repo, m.redis)

      const grouped = await svc.listPermissionsGrouped()

      expect(Object.keys(grouped).sort()).toEqual(['banking', 'clients'])
      expect(grouped.banking).toHaveLength(2)
      expect(grouped.clients).toHaveLength(1)
    })
  })
})
