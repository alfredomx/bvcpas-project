# 15-permissions — RBAC dinámico con overrides por usuario

**Estado del módulo**: ✅ Cerrado con v0.15.0.
**Apertura**: 2026-06-12.
**Cierre**: 2026-06-12.

## Norte del módulo

Reemplazar el sistema actual de roles fijos (`users.role` con enum `admin|viewer`) por un sistema RBAC dinámico configurable con:

- **Roles configurables**: el operador (admin) crea/edita roles con N permisos vía endpoint.
- **Permisos atómicos**: cada acción del sistema declara un permission code (`banking.credentials.delete`, etc.).
- **Overrides por usuario**: encima de los roles asignados, un usuario puede tener permisos extra (grant) o denegados (deny). Caso real motivador: Lorena e Ileana ambas son "bookkeeper" pero Lorena puede borrar credenciales bancarias y Ileana no.

Es el bloque base para que `22-bank-worker` (avance pausado en branch `mapi/22-bank-worker`) pueda diferenciar permisos finos para la oficina.

## Caso de uso motivador

La oficina entera (Lorena, Ileana, etc., usuarios no-admin) va a entrar a mapi para agregar/editar credenciales bancarias. Pero NO todos pueden borrarlas (acción peligrosa — credenciales irrecuperables). Hoy mapi solo tiene `admin/viewer`:

- `viewer` no debe poder editar nada — semánticamente es "solo lectura".
- `admin` puede todo — demasiado privilegio para personal de oficina.

Necesitamos algo entre `admin` y `viewer` con permisos personalizados por usuario.

## Decisión D-mapi-PRM-001 — RBAC con overrides por usuario (Nivel 3)

3 niveles posibles de granularidad de permisos:

1. **Rol fijo** (lo que tiene mapi hoy). Sin flexibilidad.
2. **Roles configurables**. Todos los del mismo rol tienen los mismos permisos. No sirve para Lorena vs Ileana.
3. **Roles + overrides por usuario**. Mismo rol, distintos permisos efectivos vía grant/deny por usuario.

Se adopta **Nivel 3**. Schema:

- `roles` — catálogo de roles configurables.
- `permissions` — catálogo de permisos atómicos (`banking.credentials.delete`, etc.).
- `role_permissions` — qué permisos tiene cada rol.
- `user_roles` — qué roles tiene cada usuario.
- `user_permissions` — overrides individuales (grant extra o deny específico).

Permiso efectivo del usuario:

```
permisos_efectivos =
    (UNION de role_permissions de sus user_roles)
  UNION
    (user_permissions WHERE granted = true)
  EXCEPT
    (user_permissions WHERE granted = false)
```

## Decisión D-mapi-PRM-002 — Módulo separado `15-permissions`

Auth (login, sesiones, password) y Permissions (roles, permisos, asignaciones) son dominios distintos. Permissions vive en módulo aparte (`15-permissions`) y NO dentro de `10-core-auth`.

- Si después agregas 2FA o cambias bcrypt, no afecta permissions.
- 10-core-auth ya es grande.
- Frontend va a tener UI separadas para "Mi cuenta" (auth) y "Permisos del equipo" (RBAC).

## Decisión D-mapi-PRM-003 — Migración total: eliminar `users.role`

Hoy `users.role text = 'admin' | 'viewer'`. Se elimina la columna y se migra a RBAC dinámico:

- Se crean **2 roles del sistema** con `is_system=true` (no se pueden borrar ni renombrar):
  - `Administrator` — tiene todos los permisos del sistema (`*`).
  - `Viewer` — tiene permisos de solo lectura en todos los módulos (`*.read`).
- Se migra cada usuario actual a un rol del sistema según su `users.role` previo.
- Se eliminan los 19 `@Roles('admin')` y `@Roles('admin', 'viewer')` del código y se reemplazan por `@RequirePermission('<modulo>.<recurso>.<accion>')`.
- Se elimina la columna `users.role` al final de la migración.

Trade-off: es trabajo mecánico (19 archivos) pero limpio. Coexistencia con `users.role` quedaría como deuda técnica permanente.

## Decisión D-mapi-PRM-004 — Sintaxis `<modulo>.<recurso>.<accion>`

Formato de permission codes: `<modulo>.<accion>` (consolidado por módulo, D-mapi-PRM-007).

- Separador: punto (estándar Laravel/Spring).
- Wildcard `*`: aplica a todos los permisos del sistema. Solo el rol `Administrator` lo tiene.
- Sub-wildcard `<modulo>.*`: aplica a todos los permisos del módulo.
- Sub-wildcard `*.read`: aplica a todos los `read` de todos los módulos (rol Viewer).

**Catálogo final (24 permisos):**

```
# Sistema
system.users.manage
system.roles.manage
system.permissions.manage

# Clients
clients.read
clients.create
clients.update
clients.delete

# Customer Support (cubre followups + responses + transactions + public_links + uncats)
customer_support.read
customer_support.create
customer_support.update
customer_support.delete

# Call Logs
call_logs.read
call_logs.create
call_logs.update
call_logs.delete

# Intuit (OAuth + admin proxy V3)
intuit.read
intuit.create
intuit.update
intuit.delete

# Connections (Microsoft + Dropbox + Google + Square + Clover)
connections.read
connections.create
connections.update
connections.delete

# Banking (consumido por 22-bank-worker cuando se retome la branch)
banking.read
banking.create
banking.update
banking.delete
```

## Decisión D-mapi-PRM-007 — Permisos consolidados a nivel módulo (sin granularidad por sub-recurso)

Cada módulo expone 4 permisos: `.read`, `.create`, `.update`, `.delete`. No se distingue entre sub-recursos del módulo (ej. en customer_support no hay `customer_support.followups.delete` separado de `customer_support.responses.delete` — basta con `customer_support.delete` que cubre ambos).

Razones:
- Menos permisos en la tabla = menos cosas que el operador tiene que conocer al asignar roles.
- UI más simple en v0.15.1.
- Granularidad fina es especulativa hoy — no hay caso de uso real de "esta persona puede borrar followups pero no responses".
- Cuando aparezca un caso real (ej. necesidad de que alguien borre solo en un sub-recurso específico), se agrega el permiso granular en ese momento — 3 pasos baratos: nuevo entry en el registry, INSERT en `permissions`, cambiar el `@RequirePermission` en el endpoint. Los usuarios existentes mantienen el consolidado.

Excepción: módulos `system`, `intuit`, `connections` que tienen acciones de gestión específicas (`system.users.manage`, etc.) en lugar del patrón CRUD uniforme — porque su naturaleza es administrar configuración, no CRUD de datos. Ver catálogo arriba: `intuit` y `connections` SÍ siguen el patrón uniforme `.read/.create/.update/.delete`. Solo `system` tiene `.manage` por sub-recurso (users, roles, permissions).

## Decisión D-mapi-PRM-008 — Migration atómica (transaction provista por drizzle)

La migration que crea las 5 tablas + seedea roles del sistema + seedea permisos + asigna permisos a roles + migra usuarios existentes (según `users.role`) + droppea la columna `users.role` debe aplicarse **atómicamente**.

Razones:

- Si algo falla a la mitad (ej. el INSERT de los permisos), Postgres revierte automáticamente y la DB queda en el estado previo.
- Cero estado intermedio donde los usuarios queden sin acceso (ej. `users.role` ya droppeada pero `user_roles` vacía).

**Implementación:** drizzle-orm/node-postgres ya envuelve cada archivo de migration en una transaction propia. **NO incluir `BEGIN/COMMIT` manuales** en el archivo SQL — generan warnings `25001` (transacción anidada) sin aportar atomicidad extra.

Drawback: transaction larga puede bloquear DB unos segundos en prod. Se aplica en ventana de mantenimiento de 5-10 min.

## Decisión D-mapi-PRM-009 — Endpoint `GET /v1/auth/me/permissions` con wildcards expandidos

Shape del response:

```json
{
  "roles": [
    { "id": "uuid", "name": "Bookkeeper", "isSystem": false }
  ],
  "permissions": [
    "banking.read",
    "banking.create",
    "banking.update"
  ]
}
```

- `roles`: lista de roles del usuario (informativo para UI tipo "Logueado como Bookkeeper").
- `permissions`: array plano de permission codes efectivos (después de aplicar overrides). **Wildcards expandidos literalmente**: si el user tiene `*`, recibe los 24 codes explícitos; si tiene `*.read`, recibe los 7 `.read` explícitos.

Razón: frontend no necesita implementar lógica de wildcards. Para mostrar/ocultar una sección del sidebar, basta con `permissions.includes('banking.read')`.

Costo: ~1KB extra en el response. Aceptable.

## Decisión D-mapi-PRM-010 — Frontend decide visibilidad de secciones con la lista de permisos

Backend SOLO controla acceso a endpoints (devuelve 403 si no hay permiso). Visibilidad de secciones del sidebar/menú es responsabilidad del frontend (`apps/bvcpas`).

Patrón: si el user no tiene **ningún** permiso del módulo (ej. ningún `banking.*`), la sección "Banking" NO aparece en el sidebar. Si tiene al menos uno (ej. solo `banking.read`), la sección aparece y los botones individuales (Crear, Editar, Borrar) se habilitan/deshabilitan según los permisos específicos.

Consecuencia operativa: entre el cierre de v0.15.0 (backend) y v0.15.1 (frontend), NO se da acceso al sistema a usuarios distintos de Administrator — porque el frontend actual no oculta secciones todavía. Si un Bookkeeper se logueara antes de v0.15.1, vería el sidebar completo aunque los endpoints respondan 403. Para evitar confusión, los usuarios de oficina se crean DESPUÉS de cerrar v0.15.1.

## Decisión D-mapi-PRM-005 — UI viene en v0.15.1, no en v0.15.0

v0.15.0 entrega backend completo de RBAC + migración + decoradores nuevos en los 19 endpoints existentes. La UI para que el admin gestione roles/permisos/usuarios vía pantalla viene en `bvcpas` v0.15.1 (frontend). Mientras tanto se gestiona vía Scalar.

Es el patrón del resto de mapi (backend first, UI después).

## Decisión D-mapi-PRM-006 — Cache Redis con TTL 15min

Cada request autenticado tiene que validar permisos. JOIN de 4 tablas por request mata performance. Cache:

- Login → calcular permisos efectivos del user → guardar en Redis `user:permissions:{userId}` con TTL 15min. Valor: array de permission codes.
- Cambio en roles del user, role_permissions de un rol que el user tiene, o user_permissions del user → invalidar la key inmediatamente.
- `PermissionsGuard` lee de Redis primero, cae a DB solo si miss (recalcula y popula).

Justificación TTL 15min: balance entre performance (no recalcular en cada request) y propagación de cambios (si invalidación falla por race condition, la stale data dura máx 15min).

## Schema

### Tabla `roles`

```
id              uuid PK              DEFAULT gen_random_uuid()
name            text                 UNIQUE, NOT NULL       -- "Administrator", "Bookkeeper - Senior"
description     text                 NULL
is_system       boolean              NOT NULL DEFAULT false  -- true = no editable/eliminable
created_at      timestamptz          NOT NULL DEFAULT now()
updated_at      timestamptz          NOT NULL DEFAULT now()
```

Roles del sistema (creados en migration, `is_system=true`):

- **Administrator** — permiso wildcard `*`.
- **Viewer** — permiso wildcard `*.read`.

### Tabla `permissions`

```
id              uuid PK              DEFAULT gen_random_uuid()
code            text                 UNIQUE, NOT NULL       -- "banking.credentials.delete"
description     text                 NOT NULL               -- "Eliminar credenciales bancarias permanentemente"
module          text                 NOT NULL               -- "banking", "clients", "system"
created_at      timestamptz          NOT NULL DEFAULT now()
```

Catálogo se popula en migration desde un registry en código (`PermissionsRegistry`).

### Tabla `role_permissions`

```
role_id         uuid                 NOT NULL, FK roles.id ON DELETE CASCADE
permission_id   uuid                 NOT NULL, FK permissions.id ON DELETE CASCADE
granted_at      timestamptz          NOT NULL DEFAULT now()
granted_by      uuid                 NULL, FK users.id     -- quién hizo el grant

PRIMARY KEY (role_id, permission_id)
```

### Tabla `user_roles`

```
user_id         uuid                 NOT NULL, FK users.id ON DELETE CASCADE
role_id         uuid                 NOT NULL, FK roles.id ON DELETE CASCADE
granted_at      timestamptz          NOT NULL DEFAULT now()
granted_by      uuid                 NULL, FK users.id

PRIMARY KEY (user_id, role_id)
```

### Tabla `user_permissions`

```
user_id         uuid                 NOT NULL, FK users.id ON DELETE CASCADE
permission_id   uuid                 NOT NULL, FK permissions.id ON DELETE CASCADE
granted         boolean              NOT NULL              -- true = grant extra, false = deny override
reason          text                 NULL                  -- "Lorena puede borrar, autorizado por Alfredo"
granted_at      timestamptz          NOT NULL DEFAULT now()
granted_by      uuid                 NULL, FK users.id

PRIMARY KEY (user_id, permission_id)
```

## Componentes de código

### `PermissionsRegistry` (`src/core/permissions/permissions.registry.ts`)

Catálogo source-of-truth de permisos en código. Tipo:

```ts
export const PERMISSIONS = [
  { code: 'banking.portals.read', module: 'banking', description: 'Ver portales bancarios' },
  { code: 'banking.portals.create', module: 'banking', description: 'Crear portales bancarios' },
  // ...
  { code: 'system.users.manage', module: 'system', description: 'Gestionar usuarios del sistema' },
] as const

export type PermissionCode = (typeof PERMISSIONS)[number]['code']
```

Sirve para:

- Migration: insertar permisos en la tabla `permissions` desde acá.
- `@RequirePermission()` decorator: typesafe — solo acepta codes del registry.
- Tests: validar coverage de permisos.

### Decorator `@RequirePermission(...codes)`

```ts
@RequirePermission('banking.credentials.delete')
@Delete(':id')
async delete(@Param('id') id: string) { ... }
```

Acepta múltiples codes (cualquiera basta) o uno solo. La metadata se lee en el `PermissionsGuard`.

### `PermissionsGuard` (reemplaza `RolesGuard`)

Pasos en cada request:

1. Si el endpoint no tiene `@RequirePermission`, pasa sin checar.
2. Lee `req.user.userId` (del JWT, dejado por `JwtAuthGuard`).
3. Lee permisos efectivos desde Redis (`user:permissions:{userId}`).
4. Si miss en Redis → calcula desde DB con el SQL del D-mapi-PRM-001 → popula Redis con TTL 15min.
5. Verifica que el user tenga al menos uno de los `required` codes. Soporta wildcards: si user tiene `*`, pasa todo; si tiene `banking.*`, pasa todo banking; si tiene `*.read`, pasa todos los read.
6. Si no tiene → `InsufficientPermissionsError` (HTTP 403) con detalle de qué permission faltó (sin exponer permisos que SÍ tiene, por seguridad).

### `PermissionsService`

API interna:

- `getEffectivePermissions(userId)` — devuelve array de `PermissionCode`, lee de Redis o DB.
- `invalidateUserCache(userId)` — borra la key Redis.
- `invalidateUsersWithRole(roleId)` — borra keys de todos los users que tienen ese rol (al modificar `role_permissions`).
- `assignRoleToUser(userId, roleId, grantedBy)` — inserta en `user_roles` + invalida cache.
- `revokeRoleFromUser(userId, roleId)` — borra de `user_roles` + invalida.
- `grantPermissionToUser(userId, permissionId, reason, grantedBy)` — inserta en `user_permissions` con `granted=true` + invalida.
- `denyPermissionForUser(userId, permissionId, reason, grantedBy)` — inserta en `user_permissions` con `granted=false` + invalida.
- Idem para roles y role_permissions CRUD.

## Sub-versiones planeadas

- **v0.15.0** — Backend completo: schema + tablas + registry + guard + decorators + endpoints CRUD + migración de los 19 `@Roles('admin')` existentes + eliminación de `users.role`.
- **v0.15.1** — Frontend (en `apps/bvcpas`): UI para que admin gestione roles, permisos, asignaciones, overrides.

Después de cerrar v0.15.0/v0.15.1 se retoma `mapi/22-bank-worker` con `@RequirePermission` desde el día 1.

## Fuera de alcance del módulo (BACKLOG)

- **Audit log de cambios de permisos**: quién dio qué permission a quién y cuándo. Hoy se captura mínimo en `granted_by` + `granted_at`, pero un log dedicado con before/after es BACKLOG hasta que llegue un caso real de auditoría.
- **Roles delegables**: admins que pueden gestionar roles pero no eliminarlos. Hoy `is_system=true` impide eliminar los 2 del sistema; lo demás es todo-o-nada.
- **Permisos temporales con expiración**: ej. "Lorena tiene permission X solo durante diciembre". BACKLOG.
- **Grupos de usuarios**: ej. "el departamento de banking". Hoy se modela con roles; si crece la necesidad, agregar tabla `user_groups`. BACKLOG.

## Versiones

| Versión | Estado | Tema                                                                          | Archivo                  |
| ------- | ------ | ----------------------------------------------------------------------------- | ------------------------ |
| 0.15.0  | 📅     | Backend RBAC completo + migración 19 endpoints + drop `users.role`            | [v0.15.0.md](v0.15.0.md) |
