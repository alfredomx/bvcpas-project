-- v0.15.0 — RBAC dinámico con overrides por usuario.
-- Decisión D-mapi-PRM-008: atomicidad garantizada por el migrator de
-- drizzle (cada archivo se aplica dentro de una transaction propia).
-- Si algo falla, rollback completo. Cero estado intermedio donde
-- los usuarios queden sin acceso.
-- NOTA: NO incluir BEGIN/COMMIT manuales aquí — drizzle ya envuelve
-- el archivo entero en una transaction. Hacer BEGIN propio genera
-- warnings 25001/25P01 (transacción anidada). Cosmético pero ruidoso.

-- ════════════════════════════════════════════════════════════════════
-- Paso 1: Crear las 5 tablas del sistema RBAC.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"module" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"user_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"granted" boolean NOT NULL,
	"reason" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid,
	CONSTRAINT "user_permissions_user_id_permission_id_pk" PRIMARY KEY("user_id","permission_id")
);
--> statement-breakpoint

-- ════════════════════════════════════════════════════════════════════
-- Paso 2: Foreign keys.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- ════════════════════════════════════════════════════════════════════
-- Paso 3: Seed roles del sistema (D-mapi-PRM-001).
-- UUIDs hardcoded para poder referenciarlos desde código sin lookup.
-- ════════════════════════════════════════════════════════════════════

INSERT INTO "roles" ("id", "name", "description", "is_system") VALUES
	('00000000-0000-0000-0000-000000000001', 'Administrator', 'Super-rol con todos los permisos del sistema. No editable ni eliminable.', true),
	('00000000-0000-0000-0000-000000000002', 'Viewer', 'Solo lectura en todos los modulos. No editable ni eliminable.', true);
--> statement-breakpoint

-- ════════════════════════════════════════════════════════════════════
-- Paso 4: Seed permisos del catalogo (24 codes desde
--   src/core/permissions/permissions.registry.ts).
-- Decision D-mapi-PRM-007: consolidado por modulo, sin granularidad
-- por sub-recurso.
-- ════════════════════════════════════════════════════════════════════

INSERT INTO "permissions" ("code", "description", "module") VALUES
	-- System (3)
	('system.users.manage', 'Gestionar usuarios del sistema (crear, editar, deshabilitar)', 'system'),
	('system.roles.manage', 'Gestionar roles y sus permisos', 'system'),
	('system.permissions.manage', 'Asignar overrides individuales de permisos por usuario', 'system'),
	-- Clients (4)
	('clients.read', 'Ver clientes del despacho', 'clients'),
	('clients.create', 'Crear nuevos clientes', 'clients'),
	('clients.update', 'Editar informacion de clientes existentes', 'clients'),
	('clients.delete', 'Dar de baja (soft delete) clientes', 'clients'),
	-- Customer Support (4)
	('customer_support.read', 'Ver uncats, followups, responses y links publicos de clientes', 'customer_support'),
	('customer_support.create', 'Crear followups, links publicos, snapshots de uncats', 'customer_support'),
	('customer_support.update', 'Editar followups, responses, configuracion de links publicos', 'customer_support'),
	('customer_support.delete', 'Borrar followups, responses, links publicos', 'customer_support'),
	-- Call Logs (4)
	('call_logs.read', 'Ver bitacora de llamadas a clientes', 'call_logs'),
	('call_logs.create', 'Registrar nuevas llamadas en la bitacora', 'call_logs'),
	('call_logs.update', 'Editar entradas de la bitacora de llamadas', 'call_logs'),
	('call_logs.delete', 'Borrar entradas de la bitacora (hard delete)', 'call_logs'),
	-- Intuit (4)
	('intuit.read', 'Ver conexiones Intuit (status de tokens, realm IDs)', 'intuit'),
	('intuit.create', 'Conectar nuevos clientes a QuickBooks Online (OAuth)', 'intuit'),
	('intuit.update', 'Reconectar clientes existentes; ejecutar proxy V3 admin', 'intuit'),
	('intuit.delete', 'Desconectar clientes de QuickBooks Online', 'intuit'),
	-- Connections (4)
	('connections.read', 'Ver conexiones a servicios externos (Outlook, Drive, etc.)', 'connections'),
	('connections.create', 'Conectar nuevos servicios externos via OAuth o api_key', 'connections'),
	('connections.update', 'Editar conexiones, asignar shares a otros usuarios, refresh', 'connections'),
	('connections.delete', 'Desconectar servicios externos (revocar tokens)', 'connections'),
	-- Banking (4) — pre-declarado para 22-bank-worker
	('banking.read', 'Ver portales bancarios, credenciales y cuentas de clientes', 'banking'),
	('banking.create', 'Agregar portales, credenciales y cuentas bancarias', 'banking'),
	('banking.update', 'Editar credenciales bancarias y datos de cuentas', 'banking'),
	('banking.delete', 'Borrar credenciales y cuentas bancarias (accion peligrosa)', 'banking');
--> statement-breakpoint

-- ════════════════════════════════════════════════════════════════════
-- Paso 5: Asignar permisos a los roles del sistema.
-- ════════════════════════════════════════════════════════════════════

-- Administrator: TODOS los permisos.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT '00000000-0000-0000-0000-000000000001', id FROM "permissions";
--> statement-breakpoint

-- Viewer: TODOS los .read.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT '00000000-0000-0000-0000-000000000002', id FROM "permissions" WHERE code LIKE '%.read';
--> statement-breakpoint

-- ════════════════════════════════════════════════════════════════════
-- Paso 6: Migrar usuarios existentes segun users.role.
-- Cada user con role='admin' → asignar rol Administrator.
-- Cada user con role='viewer' → asignar rol Viewer.
-- ════════════════════════════════════════════════════════════════════

INSERT INTO "user_roles" ("user_id", "role_id")
SELECT id, '00000000-0000-0000-0000-000000000001' FROM "users" WHERE role = 'admin';
--> statement-breakpoint

INSERT INTO "user_roles" ("user_id", "role_id")
SELECT id, '00000000-0000-0000-0000-000000000002' FROM "users" WHERE role = 'viewer';
--> statement-breakpoint

-- ════════════════════════════════════════════════════════════════════
-- Paso 7: Eliminar la columna users.role y su index.
-- El index users_status_role_idx (status, role) ya no aplica.
-- Se reemplaza por users_status_idx solo con status.
-- ════════════════════════════════════════════════════════════════════

DROP INDEX "users_status_role_idx";
--> statement-breakpoint

ALTER TABLE "users" DROP COLUMN "role";
--> statement-breakpoint

CREATE INDEX "users_status_idx" ON "users" ("status");
