/**
 * Catálogo source-of-truth de permisos del sistema RBAC.
 *
 * Esta es la fuente única de verdad — la tabla `permissions` en DB se
 * popula desde aquí en la migration inicial. Cuando se agreguen permisos
 * nuevos (ej. cuando se retome `mapi/22-bank-worker`):
 *
 *   1. Agregar la entrada a `PERMISSIONS` aquí.
 *   2. Generar migration drizzle que INSERT el nuevo permission.
 *   3. Usar el code en el decorator `@RequirePermission(...)` en el
 *      endpoint correspondiente.
 *
 * Decisión D-mapi-PRM-004: formato `<modulo>.<accion>` con puntos.
 * Decisión D-mapi-PRM-007: consolidado por módulo (sin granularidad
 *   por sub-recurso) — un solo `customer_support.delete` cubre
 *   followups + responses + transactions + public_links.
 *
 * Wildcards (resueltos en `PermissionsGuard`, NO viven aquí):
 *   - `*` → todos los permisos del sistema (rol Administrator).
 *   - `<modulo>.*` → todos los permisos del módulo.
 *   - `*.read` → todos los `.read` de todos los módulos (rol Viewer).
 */
export const PERMISSIONS = [
  // ── System ────────────────────────────────────────────────────────
  // Gestión del propio sistema (users, roles, permisos). Solo
  // Administrator los tiene en v0.15.0.
  {
    code: 'system.users.manage',
    module: 'system',
    description: 'Gestionar usuarios del sistema (crear, editar, deshabilitar)',
  },
  {
    code: 'system.roles.manage',
    module: 'system',
    description: 'Gestionar roles y sus permisos',
  },
  {
    code: 'system.permissions.manage',
    module: 'system',
    description: 'Asignar overrides individuales de permisos por usuario',
  },

  // ── Clients ───────────────────────────────────────────────────────
  {
    code: 'clients.read',
    module: 'clients',
    description: 'Ver clientes del despacho',
  },
  {
    code: 'clients.create',
    module: 'clients',
    description: 'Crear nuevos clientes',
  },
  {
    code: 'clients.update',
    module: 'clients',
    description: 'Editar información de clientes existentes',
  },
  {
    code: 'clients.delete',
    module: 'clients',
    description: 'Dar de baja (soft delete) clientes',
  },

  // ── Customer Support ──────────────────────────────────────────────
  // Consolidado: cubre followups + responses + transactions + public_links + uncats.
  {
    code: 'customer_support.read',
    module: 'customer_support',
    description: 'Ver uncats, followups, responses y links públicos de clientes',
  },
  {
    code: 'customer_support.create',
    module: 'customer_support',
    description: 'Crear followups, links públicos, snapshots de uncats',
  },
  {
    code: 'customer_support.update',
    module: 'customer_support',
    description: 'Editar followups, responses, configuración de links públicos',
  },
  {
    code: 'customer_support.delete',
    module: 'customer_support',
    description: 'Borrar followups, responses, links públicos',
  },

  // ── Call Logs ─────────────────────────────────────────────────────
  {
    code: 'call_logs.read',
    module: 'call_logs',
    description: 'Ver bitácora de llamadas a clientes',
  },
  {
    code: 'call_logs.create',
    module: 'call_logs',
    description: 'Registrar nuevas llamadas en la bitácora',
  },
  {
    code: 'call_logs.update',
    module: 'call_logs',
    description: 'Editar entradas de la bitácora de llamadas',
  },
  {
    code: 'call_logs.delete',
    module: 'call_logs',
    description: 'Borrar entradas de la bitácora (hard delete)',
  },

  // ── Intuit ────────────────────────────────────────────────────────
  // OAuth + admin proxy V3 de QuickBooks Online.
  {
    code: 'intuit.read',
    module: 'intuit',
    description: 'Ver conexiones Intuit (status de tokens, realm IDs)',
  },
  {
    code: 'intuit.create',
    module: 'intuit',
    description: 'Conectar nuevos clientes a QuickBooks Online (OAuth)',
  },
  {
    code: 'intuit.update',
    module: 'intuit',
    description: 'Reconectar clientes existentes; ejecutar proxy V3 admin',
  },
  {
    code: 'intuit.delete',
    module: 'intuit',
    description: 'Desconectar clientes de QuickBooks Online',
  },

  // ── Connections ───────────────────────────────────────────────────
  // Microsoft + Dropbox + Google + Square + Clover. Cubre OAuth y api_key.
  {
    code: 'connections.read',
    module: 'connections',
    description: 'Ver conexiones a servicios externos (Outlook, Drive, etc.)',
  },
  {
    code: 'connections.create',
    module: 'connections',
    description: 'Conectar nuevos servicios externos vía OAuth o api_key',
  },
  {
    code: 'connections.update',
    module: 'connections',
    description: 'Editar conexiones, asignar shares a otros usuarios, refresh',
  },
  {
    code: 'connections.delete',
    module: 'connections',
    description: 'Desconectar servicios externos (revocar tokens)',
  },

  // ── Banking ───────────────────────────────────────────────────────
  // Pre-declarado para `22-bank-worker` (avance pausado en branch
  // `mapi/22-bank-worker`). Cuando se retome esa branch, los endpoints
  // de portales/credenciales/cuentas bancarias usan estos codes.
  {
    code: 'banking.read',
    module: 'banking',
    description: 'Ver portales bancarios, credenciales y cuentas de clientes',
  },
  {
    code: 'banking.create',
    module: 'banking',
    description: 'Agregar portales, credenciales y cuentas bancarias',
  },
  {
    code: 'banking.update',
    module: 'banking',
    description: 'Editar credenciales bancarias y datos de cuentas',
  },
  {
    code: 'banking.delete',
    module: 'banking',
    description: 'Borrar credenciales y cuentas bancarias (acción peligrosa)',
  },
] as const

/**
 * Tipo unión de todos los permission codes válidos. Lo usa el decorator
 * `@RequirePermission(...)` para que TypeScript rechace codes que no
 * existen en el registry.
 */
export type PermissionCode = (typeof PERMISSIONS)[number]['code']

/**
 * Módulos del catálogo. Útil para agrupar en la UI de v0.15.1.
 */
export type PermissionModule = (typeof PERMISSIONS)[number]['module']

/**
 * Lista de todos los codes del registry, lista para iteración.
 * NO incluye wildcards — esos viven en role_permissions o user_permissions.
 */
export const PERMISSION_CODES: readonly PermissionCode[] = PERMISSIONS.map((p) => p.code)

/**
 * Set para lookup O(1) en validaciones (ej. al asignar permission a un
 * rol, verificar que el code existe en el catálogo).
 */
export const PERMISSION_CODES_SET = new Set<string>(PERMISSION_CODES)

/**
 * Helper: dado un wildcard pattern, devuelve los codes que matchean.
 *
 *   expandWildcard('*')           → todos los codes del registry.
 *   expandWildcard('banking.*')   → ['banking.read', 'banking.create', ...]
 *   expandWildcard('*.read')      → ['clients.read', 'banking.read', ...]
 *   expandWildcard('clients.read') → ['clients.read']  (no es wildcard)
 *
 * Si el pattern no matchea nada, devuelve array vacío.
 */
export function expandWildcard(pattern: string): readonly PermissionCode[] {
  if (pattern === '*') {
    return PERMISSION_CODES
  }
  if (pattern.endsWith('.*')) {
    const module = pattern.slice(0, -2)
    return PERMISSION_CODES.filter((c) => c.startsWith(`${module}.`))
  }
  if (pattern.startsWith('*.')) {
    const action = pattern.slice(2)
    return PERMISSION_CODES.filter((c) => c.endsWith(`.${action}`))
  }
  if (PERMISSION_CODES_SET.has(pattern)) {
    return [pattern as PermissionCode]
  }
  return []
}
