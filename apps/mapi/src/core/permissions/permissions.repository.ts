import { Inject, Injectable } from '@nestjs/common'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { DB, type DrizzleDb } from '../db/db.module'
import { roles, type NewRole, type Role } from '../../db/schema/roles'
import { permissions, type Permission } from '../../db/schema/permissions'
import { rolePermissions } from '../../db/schema/role-permissions'
import { userRoles, type UserRoleAssignment } from '../../db/schema/user-roles'
import { userPermissions, type UserPermission } from '../../db/schema/user-permissions'

/**
 * UUIDs hardcoded de los roles del sistema (seedeados en migration 0018).
 * Se usan para validaciones tipo "no se puede editar Administrator".
 */
export const SYSTEM_ROLE_IDS = {
  ADMINISTRATOR: '00000000-0000-0000-0000-000000000001',
  VIEWER: '00000000-0000-0000-0000-000000000002',
} as const

/**
 * Datos completos del usuario para calcular permisos efectivos.
 * Una sola query devuelve roles + permisos de esos roles + overrides
 * individuales — el service hace el merge en memoria.
 */
export interface UserPermissionsRawData {
  roleIds: string[]
  rolePermissionCodes: string[]
  userOverrides: {
    permissionCode: string
    granted: boolean
  }[]
}

@Injectable()
export class PermissionsRepository {
  constructor(@Inject(DB) private readonly db: DrizzleDb) {}

  // ── Roles ─────────────────────────────────────────────────────────

  async findAllRoles(): Promise<Role[]> {
    return this.db.select().from(roles).orderBy(roles.name)
  }

  async findRoleById(id: string): Promise<Role | null> {
    const rows = await this.db.select().from(roles).where(eq(roles.id, id)).limit(1)
    return rows[0] ?? null
  }

  async findRoleByName(name: string): Promise<Role | null> {
    const rows = await this.db.select().from(roles).where(eq(roles.name, name)).limit(1)
    return rows[0] ?? null
  }

  async createRole(data: NewRole): Promise<Role> {
    const rows = await this.db.insert(roles).values(data).returning()
    return rows[0]
  }

  async updateRole(
    id: string,
    data: { name?: string; description?: string | null },
  ): Promise<Role | null> {
    const rows = await this.db
      .update(roles)
      .set({ ...data, updatedAt: sql`now()` })
      .where(eq(roles.id, id))
      .returning()
    return rows[0] ?? null
  }

  async deleteRole(id: string): Promise<boolean> {
    const result = await this.db.delete(roles).where(eq(roles.id, id)).returning({ id: roles.id })
    return result.length > 0
  }

  // ── Permisos del catálogo ─────────────────────────────────────────

  async findAllPermissions(): Promise<Permission[]> {
    return this.db.select().from(permissions).orderBy(permissions.module, permissions.code)
  }

  async findPermissionByCode(code: string): Promise<Permission | null> {
    const rows = await this.db.select().from(permissions).where(eq(permissions.code, code)).limit(1)
    return rows[0] ?? null
  }

  async findPermissionsByCodes(codes: string[]): Promise<Permission[]> {
    if (codes.length === 0) return []
    return this.db.select().from(permissions).where(inArray(permissions.code, codes))
  }

  // ── Role permissions ──────────────────────────────────────────────

  async findPermissionCodesByRoleId(roleId: string): Promise<string[]> {
    const rows = await this.db
      .select({ code: permissions.code })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId))
    return rows.map((r) => r.code)
  }

  async grantPermissionsToRole(
    roleId: string,
    permissionIds: string[],
    grantedBy: string | null,
  ): Promise<void> {
    if (permissionIds.length === 0) return
    const values = permissionIds.map((pid) => ({
      roleId,
      permissionId: pid,
      grantedBy,
    }))
    await this.db.insert(rolePermissions).values(values).onConflictDoNothing()
  }

  async revokePermissionFromRole(roleId: string, permissionId: string): Promise<boolean> {
    const result = await this.db
      .delete(rolePermissions)
      .where(
        and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)),
      )
      .returning({ roleId: rolePermissions.roleId })
    return result.length > 0
  }

  /**
   * Devuelve los user_ids de todos los usuarios que tienen este rol.
   * Útil para invalidar cache cuando cambian los permisos del rol.
   */
  async findUserIdsByRoleId(roleId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId))
    return rows.map((r) => r.userId)
  }

  // ── User roles ────────────────────────────────────────────────────

  async findRolesByUserId(userId: string): Promise<Role[]> {
    return this.db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
        isSystem: roles.isSystem,
        createdAt: roles.createdAt,
        updatedAt: roles.updatedAt,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId))
      .orderBy(roles.name)
  }

  async findUserRole(userId: string, roleId: string): Promise<UserRoleAssignment | null> {
    const rows = await this.db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
      .limit(1)
    return rows[0] ?? null
  }

  async assignRoleToUser(userId: string, roleId: string, grantedBy: string | null): Promise<void> {
    await this.db.insert(userRoles).values({ userId, roleId, grantedBy }).onConflictDoNothing()
  }

  async revokeRoleFromUser(userId: string, roleId: string): Promise<boolean> {
    const result = await this.db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
      .returning({ userId: userRoles.userId })
    return result.length > 0
  }

  async countUserRoles(userId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
    return rows[0]?.count ?? 0
  }

  // ── User permissions (overrides) ──────────────────────────────────

  async findUserOverridesByUserId(
    userId: string,
  ): Promise<{ permissionCode: string; granted: boolean }[]> {
    const rows = await this.db
      .select({
        permissionCode: permissions.code,
        granted: userPermissions.granted,
      })
      .from(userPermissions)
      .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
      .where(eq(userPermissions.userId, userId))
    return rows
  }

  async findUserOverride(userId: string, permissionId: string): Promise<UserPermission | null> {
    const rows = await this.db
      .select()
      .from(userPermissions)
      .where(
        and(eq(userPermissions.userId, userId), eq(userPermissions.permissionId, permissionId)),
      )
      .limit(1)
    return rows[0] ?? null
  }

  async grantOrDenyOverride(data: {
    userId: string
    permissionId: string
    granted: boolean
    reason: string | null
    grantedBy: string | null
  }): Promise<UserPermission> {
    const rows = await this.db.insert(userPermissions).values(data).returning()
    return rows[0]
  }

  async deleteUserOverride(userId: string, permissionId: string): Promise<boolean> {
    const result = await this.db
      .delete(userPermissions)
      .where(
        and(eq(userPermissions.userId, userId), eq(userPermissions.permissionId, permissionId)),
      )
      .returning({ userId: userPermissions.userId })
    return result.length > 0
  }

  // ── Efectivos: una sola query bulk para el cache ──────────────────

  /**
   * Obtiene en N queries (mínimas) toda la data que el service necesita
   * para calcular los permisos efectivos del user. Lo hace en bulk para
   * no hacer un round-trip por rol.
   */
  async getUserPermissionsRawData(userId: string): Promise<UserPermissionsRawData> {
    // 1) Roles del usuario.
    const userRoleRows = await this.db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
    const roleIds = userRoleRows.map((r) => r.roleId)

    // 2) Codes de permisos de esos roles (vacío si no tiene roles).
    let rolePermissionCodes: string[] = []
    if (roleIds.length > 0) {
      const codeRows = await this.db
        .selectDistinct({ code: permissions.code })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(inArray(rolePermissions.roleId, roleIds))
      rolePermissionCodes = codeRows.map((r) => r.code)
    }

    // 3) Overrides individuales del user.
    const userOverrides = await this.findUserOverridesByUserId(userId)

    return { roleIds, rolePermissionCodes, userOverrides }
  }
}
