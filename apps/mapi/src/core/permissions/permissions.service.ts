import { Inject, Injectable, Logger } from '@nestjs/common'
import type Redis from 'ioredis'
import { REDIS_CLIENT } from '../auth/redis.module'
import { DomainError } from '../../common/errors/domain.error'
import {
  PERMISSION_CODES_SET,
  PERMISSIONS,
  expandWildcard,
  type PermissionCode,
} from './permissions.registry'
import { PermissionsRepository, SYSTEM_ROLE_IDS } from './permissions.repository'
import type { Role } from '../../db/schema/roles'
import type { Permission } from '../../db/schema/permissions'

/**
 * TTL del cache de permisos efectivos por usuario.
 * Decisión D-mapi-PRM-006: 15 minutos (~900s).
 */
const PERMISSIONS_CACHE_TTL_SECONDS = 15 * 60

/**
 * Prefix de las keys Redis. La key completa es `user:permissions:{userId}`.
 */
const CACHE_KEY_PREFIX = 'user:permissions:'

function cacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`
}

/**
 * Errores de dominio del módulo. Mapeados en `domain-error.filter.ts`
 * con sus HTTP status correspondientes.
 */
export class RoleNotFoundError extends DomainError {
  readonly code = 'ROLE_NOT_FOUND'
  constructor(roleId: string) {
    super(`Role ${roleId} not found`, { roleId })
  }
}

export class RoleNameConflictError extends DomainError {
  readonly code = 'ROLE_NAME_CONFLICT'
  constructor(name: string) {
    super(`Role name "${name}" already exists`, { name })
  }
}

export class SystemRoleNotEditableError extends DomainError {
  readonly code = 'SYSTEM_ROLE_NOT_EDITABLE'
  constructor(roleId: string, roleName: string) {
    super(`System role "${roleName}" cannot be modified or deleted`, { roleId, roleName })
  }
}

export class PermissionNotFoundError extends DomainError {
  readonly code = 'PERMISSION_NOT_FOUND'
  constructor(permissionCode: string) {
    super(`Permission code "${permissionCode}" not in registry`, { permissionCode })
  }
}

export class UserRoleAlreadyAssignedError extends DomainError {
  readonly code = 'USER_ROLE_ALREADY_ASSIGNED'
  constructor(userId: string, roleId: string) {
    super(`User ${userId} already has role ${roleId}`, { userId, roleId })
  }
}

export class UserPermissionOverrideExistsError extends DomainError {
  readonly code = 'USER_PERMISSION_OVERRIDE_EXISTS'
  constructor(userId: string, permissionCode: string) {
    super(`Override for user ${userId} / ${permissionCode} already exists`, {
      userId,
      permissionCode,
    })
  }
}

export class UserMustHaveAtLeastOneRoleError extends DomainError {
  readonly code = 'USER_MUST_HAVE_AT_LEAST_ONE_ROLE'
  constructor(userId: string) {
    super(`Cannot revoke last role of user ${userId}`, { userId })
  }
}

/**
 * Vista efectiva de los permisos del usuario.
 *
 * `permissions`: array plano de codes EXPANDIDOS literalmente
 *   (D-mapi-PRM-009). Si el user tiene wildcard `*`, este array trae
 *   los 24 codes del catálogo. Si tiene `*.read`, trae los 7 `.read`.
 */
export interface EffectivePermissions {
  roles: Role[]
  permissions: PermissionCode[]
}

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name)

  constructor(
    private readonly repo: PermissionsRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ════════════════════════════════════════════════════════════════
  // Lectura de permisos efectivos (lo que usa el guard en cada request)
  // ════════════════════════════════════════════════════════════════

  /**
   * Devuelve los codes EXPANDIDOS efectivos del usuario, leyendo de
   * Redis primero. Si miss, calcula desde DB y popula Redis.
   *
   * **NO incluye los roles** (eso lo da `getEffectivePermissions`).
   * Diseñado para que el `PermissionsGuard` haga un round-trip mínimo
   * en cada request (solo strings).
   */
  async getEffectivePermissionCodes(userId: string): Promise<PermissionCode[]> {
    const cached = await this.redis.get(cacheKey(userId))
    if (cached !== null) {
      try {
        const parsed = JSON.parse(cached) as string[]
        return parsed as PermissionCode[]
      } catch {
        this.logger.warn(`Corrupted permissions cache for user ${userId}, recalculating`)
      }
    }

    const codes = await this.computeEffectivePermissionCodes(userId)
    await this.redis.set(
      cacheKey(userId),
      JSON.stringify(codes),
      'EX',
      PERMISSIONS_CACHE_TTL_SECONDS,
    )
    return codes
  }

  /**
   * Versión completa: roles + permisos efectivos. Usado por el endpoint
   * `GET /v1/auth/me/permissions` y por `GET /v1/permissions/users/:id/effective`.
   */
  async getEffectivePermissions(userId: string): Promise<EffectivePermissions> {
    const [roles, permissions] = await Promise.all([
      this.repo.findRolesByUserId(userId),
      this.getEffectivePermissionCodes(userId),
    ])
    return { roles, permissions }
  }

  /**
   * Calcula desde DB sin tocar cache. Aplica la fórmula:
   *
   *   permisos_efectivos =
   *       (UNION de role_permissions de sus user_roles)
   *     UNION
   *       (user_permissions WHERE granted = true)
   *     EXCEPT
   *       (user_permissions WHERE granted = false)
   *
   * Después expande wildcards a codes literales (D-mapi-PRM-009).
   */
  private async computeEffectivePermissionCodes(userId: string): Promise<PermissionCode[]> {
    const { rolePermissionCodes, userOverrides } = await this.repo.getUserPermissionsRawData(userId)

    const grants = new Set<PermissionCode>()
    const denies = new Set<string>()

    // 1) Permisos heredados de roles (pueden incluir wildcards en role_permissions
    //    en versiones futuras — hoy los roles del sistema usan wildcards solo en
    //    el sentido conceptual: Administrator tiene TODOS los codes del catálogo
    //    como filas en role_permissions; Viewer tiene todos los .read. No hay
    //    columna "wildcard" persistida. Sin embargo, expandWildcard() es seguro:
    //    si el code ya es literal, devuelve [code]).
    for (const code of rolePermissionCodes) {
      for (const expanded of expandWildcard(code)) {
        grants.add(expanded)
      }
    }

    // 2) Overrides individuales: granted=true agrega, granted=false anota deny.
    for (const ov of userOverrides) {
      const expanded = expandWildcard(ov.permissionCode)
      for (const code of expanded) {
        if (ov.granted) {
          grants.add(code)
        } else {
          denies.add(code)
        }
      }
    }

    // 3) Aplicar denies (overrides false ganan sobre grants de roles).
    for (const denied of denies) {
      grants.delete(denied as PermissionCode)
    }

    return Array.from(grants).sort()
  }

  // ════════════════════════════════════════════════════════════════
  // Invalidación de cache
  // ════════════════════════════════════════════════════════════════

  async invalidateUserCache(userId: string): Promise<void> {
    await this.redis.del(cacheKey(userId))
  }

  /**
   * Invalida cache de todos los usuarios que tienen el rol dado.
   * Llamado cuando cambian los permisos del rol (grant/revoke).
   */
  async invalidateUsersWithRole(roleId: string): Promise<void> {
    const userIds = await this.repo.findUserIdsByRoleId(roleId)
    if (userIds.length === 0) return
    const keys = userIds.map(cacheKey)
    await this.redis.del(...keys)
  }

  // ════════════════════════════════════════════════════════════════
  // CRUD de roles
  // ════════════════════════════════════════════════════════════════

  async listRoles(): Promise<Role[]> {
    return this.repo.findAllRoles()
  }

  async getRoleById(roleId: string): Promise<Role> {
    const role = await this.repo.findRoleById(roleId)
    if (!role) throw new RoleNotFoundError(roleId)
    return role
  }

  async createRole(data: { name: string; description?: string | null }): Promise<Role> {
    const existing = await this.repo.findRoleByName(data.name)
    if (existing) throw new RoleNameConflictError(data.name)
    return this.repo.createRole({
      name: data.name,
      description: data.description ?? null,
      isSystem: false,
    })
  }

  async updateRole(
    roleId: string,
    data: { name?: string; description?: string | null },
  ): Promise<Role> {
    const role = await this.getRoleById(roleId)
    if (role.isSystem) {
      throw new SystemRoleNotEditableError(roleId, role.name)
    }
    if (data.name && data.name !== role.name) {
      const conflict = await this.repo.findRoleByName(data.name)
      if (conflict) throw new RoleNameConflictError(data.name)
    }
    const updated = await this.repo.updateRole(roleId, data)
    if (!updated) throw new RoleNotFoundError(roleId)
    // Invalidar cache de usuarios con este rol (description visible en /me/permissions).
    await this.invalidateUsersWithRole(roleId)
    return updated
  }

  async deleteRole(roleId: string): Promise<void> {
    const role = await this.getRoleById(roleId)
    if (role.isSystem) {
      throw new SystemRoleNotEditableError(roleId, role.name)
    }
    await this.invalidateUsersWithRole(roleId)
    await this.repo.deleteRole(roleId)
  }

  // ════════════════════════════════════════════════════════════════
  // Permisos del rol
  // ════════════════════════════════════════════════════════════════

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    await this.getRoleById(roleId) // valida que existe
    const codes = await this.repo.findPermissionCodesByRoleId(roleId)
    return this.repo.findPermissionsByCodes(codes)
  }

  async grantPermissionsToRole(
    roleId: string,
    permissionCodes: string[],
    grantedBy: string | null,
  ): Promise<void> {
    const role = await this.getRoleById(roleId)
    if (role.isSystem) {
      throw new SystemRoleNotEditableError(roleId, role.name)
    }
    // Validar que todos los codes existen en el registry.
    for (const code of permissionCodes) {
      if (!PERMISSION_CODES_SET.has(code)) {
        throw new PermissionNotFoundError(code)
      }
    }
    const perms = await this.repo.findPermissionsByCodes(permissionCodes)
    await this.repo.grantPermissionsToRole(
      roleId,
      perms.map((p) => p.id),
      grantedBy,
    )
    await this.invalidateUsersWithRole(roleId)
  }

  async revokePermissionFromRole(roleId: string, permissionCode: string): Promise<void> {
    const role = await this.getRoleById(roleId)
    if (role.isSystem) {
      throw new SystemRoleNotEditableError(roleId, role.name)
    }
    const perm = await this.repo.findPermissionByCode(permissionCode)
    if (!perm) throw new PermissionNotFoundError(permissionCode)
    await this.repo.revokePermissionFromRole(roleId, perm.id)
    await this.invalidateUsersWithRole(roleId)
  }

  // ════════════════════════════════════════════════════════════════
  // User roles (asignación)
  // ════════════════════════════════════════════════════════════════

  async assignRoleToUser(userId: string, roleId: string, grantedBy: string | null): Promise<void> {
    await this.getRoleById(roleId) // valida que existe
    const existing = await this.repo.findUserRole(userId, roleId)
    if (existing) {
      throw new UserRoleAlreadyAssignedError(userId, roleId)
    }
    await this.repo.assignRoleToUser(userId, roleId, grantedBy)
    await this.invalidateUserCache(userId)
  }

  async revokeRoleFromUser(userId: string, roleId: string): Promise<void> {
    const count = await this.repo.countUserRoles(userId)
    if (count <= 1) {
      throw new UserMustHaveAtLeastOneRoleError(userId)
    }
    await this.repo.revokeRoleFromUser(userId, roleId)
    await this.invalidateUserCache(userId)
  }

  // ════════════════════════════════════════════════════════════════
  // User permissions (overrides)
  // ════════════════════════════════════════════════════════════════

  async setUserPermissionOverride(data: {
    userId: string
    permissionCode: string
    granted: boolean
    reason: string | null
    grantedBy: string | null
  }): Promise<void> {
    const perm = await this.repo.findPermissionByCode(data.permissionCode)
    if (!perm) {
      throw new PermissionNotFoundError(data.permissionCode)
    }
    const existing = await this.repo.findUserOverride(data.userId, perm.id)
    if (existing) {
      throw new UserPermissionOverrideExistsError(data.userId, data.permissionCode)
    }
    await this.repo.grantOrDenyOverride({
      userId: data.userId,
      permissionId: perm.id,
      granted: data.granted,
      reason: data.reason,
      grantedBy: data.grantedBy,
    })
    await this.invalidateUserCache(data.userId)
  }

  async removeUserPermissionOverride(userId: string, permissionCode: string): Promise<boolean> {
    const perm = await this.repo.findPermissionByCode(permissionCode)
    if (!perm) {
      throw new PermissionNotFoundError(permissionCode)
    }
    const removed = await this.repo.deleteUserOverride(userId, perm.id)
    if (removed) {
      await this.invalidateUserCache(userId)
    }
    return removed
  }

  // ════════════════════════════════════════════════════════════════
  // Catálogo de permisos (read-only)
  // ════════════════════════════════════════════════════════════════

  async listAllPermissions(): Promise<Permission[]> {
    return this.repo.findAllPermissions()
  }

  /**
   * Devuelve el catálogo agrupado por módulo. Útil para la UI de v0.15.1.
   */
  async listPermissionsGrouped(): Promise<Record<string, Permission[]>> {
    const all = await this.listAllPermissions()
    const grouped: Record<string, Permission[]> = {}
    for (const p of all) {
      if (!grouped[p.module]) grouped[p.module] = []
      grouped[p.module].push(p)
    }
    return grouped
  }
}

// Exports auxiliares para tests
export { PERMISSIONS, SYSTEM_ROLE_IDS }
