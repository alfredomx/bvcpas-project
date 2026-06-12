import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// ════════════════════════════════════════════════════════════════════
// Roles
// ════════════════════════════════════════════════════════════════════

const RoleSchema = z.object({
  id: z.string().uuid().describe('UUID del rol'),
  name: z.string().describe('Nombre único (ej. "Administrator", "Bookkeeper")'),
  description: z.string().nullable().describe('Descripción libre del rol'),
  is_system: z
    .boolean()
    .describe('true = rol del sistema (Administrator, Viewer) — no se puede editar ni eliminar'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export class RoleDto extends createZodDto(RoleSchema) {}

const RolesListResponseSchema = z.object({
  data: z.array(RoleSchema),
})

export class RolesListResponseDto extends createZodDto(RolesListResponseSchema) {}

export const CreateRoleSchema = z
  .object({
    name: z.string().min(1).max(80).describe('Nombre único del rol'),
    description: z.string().max(500).optional().describe('Descripción libre opcional'),
  })
  .describe('Crear rol RBAC nuevo')

export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}

export const UpdateRoleSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    description: z.string().max(500).nullable().optional(),
  })
  .describe('Edita nombre y/o descripción del rol. No editable en roles del sistema.')

export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}

// ════════════════════════════════════════════════════════════════════
// Permisos del rol
// ════════════════════════════════════════════════════════════════════

const PermissionSchema = z.object({
  id: z.string().uuid(),
  code: z.string().describe('Código atómico: `<modulo>.<accion>` (ej. "banking.delete")'),
  description: z.string(),
  module: z.string().describe('Módulo agrupador (ej. "banking", "system")'),
})

export class PermissionDto extends createZodDto(PermissionSchema) {}

const PermissionsListResponseSchema = z.object({
  data: z.array(PermissionSchema),
})

export class PermissionsListResponseDto extends createZodDto(PermissionsListResponseSchema) {}

const PermissionsGroupedResponseSchema = z
  .object({
    modules: z.record(z.string(), z.array(PermissionSchema)),
  })
  .describe('Catálogo de permisos agrupado por módulo. Útil para UI de gestión.')

export class PermissionsGroupedResponseDto extends createZodDto(PermissionsGroupedResponseSchema) {}

export const GrantPermissionsToRoleSchema = z
  .object({
    permission_codes: z
      .array(z.string().min(1))
      .min(1)
      .describe('Lista de codes a otorgar al rol. Codes deben existir en el catálogo.'),
  })
  .describe('Otorga uno o más permisos al rol')

export class GrantPermissionsToRoleDto extends createZodDto(GrantPermissionsToRoleSchema) {}

// ════════════════════════════════════════════════════════════════════
// User roles
// ════════════════════════════════════════════════════════════════════

export const AssignRoleToUserSchema = z
  .object({
    role_id: z.string().uuid().describe('UUID del rol a asignar'),
  })
  .describe('Asigna un rol RBAC al usuario')

export class AssignRoleToUserDto extends createZodDto(AssignRoleToUserSchema) {}

// ════════════════════════════════════════════════════════════════════
// User permissions (overrides individuales)
// ════════════════════════════════════════════════════════════════════

export const SetUserPermissionOverrideSchema = z
  .object({
    permission_code: z
      .string()
      .min(1)
      .describe('Code del permiso (ej. "banking.delete"). Debe existir en el catálogo.'),
    granted: z
      .boolean()
      .describe(
        'true = otorga el permiso aunque su rol no lo tenga. false = niega el permiso aunque su rol sí lo tenga.',
      ),
    reason: z
      .string()
      .max(500)
      .optional()
      .describe('Justificación textual del override (para auditoría)'),
  })
  .describe('Crea un override individual de permiso para el usuario')

export class SetUserPermissionOverrideDto extends createZodDto(SetUserPermissionOverrideSchema) {}

// ════════════════════════════════════════════════════════════════════
// Vista efectiva
// ════════════════════════════════════════════════════════════════════

const EffectivePermissionsResponseSchema = z
  .object({
    roles: z.array(RoleSchema).describe('Roles asignados al usuario'),
    permissions: z
      .array(z.string())
      .describe(
        'Permission codes EFECTIVOS (expandidos literalmente, ya incluyendo overrides individuales)',
      ),
  })
  .describe('Permisos efectivos del usuario después de aplicar roles + overrides')

export class EffectivePermissionsResponseDto extends createZodDto(
  EffectivePermissionsResponseSchema,
) {}
