CREATE TABLE "user_client_access" (
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_client_access_user_id_client_id_pk" PRIMARY KEY("user_id","client_id")
);
--> statement-breakpoint
ALTER TABLE "user_connections" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "user_connections" ADD COLUMN "scope_type" text DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_connections" ADD COLUMN "refresh_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_client_access" ADD CONSTRAINT "user_client_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_client_access" ADD CONSTRAINT "user_client_access_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- ============================================================
-- v0.8.0 — Migración de datos Intuit y permisos iniciales
-- (Manual; no generado por drizzle-kit)
-- ============================================================

-- CHECK constraint: scope_type sólo admite los valores enum.
ALTER TABLE "user_connections"
  ADD CONSTRAINT "user_connections_scope_type_check"
  CHECK ("scope_type" IN ('full', 'readonly'));
--> statement-breakpoint

-- D-mapi-026: las 77 conexiones Intuit migran como 'full' al user
-- alfredo@pixvector.mx (initial admin). NO se marca ninguna como
-- 'readonly' aún — la cuenta global customer-service@bv-cpas.com se
-- conectará después de v0.8.0 fuera del alcance.
INSERT INTO "user_connections" (
  "user_id", "provider", "external_account_id",
  "client_id", "scope_type",
  "scopes",
  "access_token_encrypted", "refresh_token_encrypted",
  "access_token_expires_at", "refresh_token_expires_at",
  "last_refreshed_at", "created_at", "updated_at"
)
SELECT
  (SELECT id FROM users WHERE email = 'alfredo@pixvector.mx' LIMIT 1),
  'intuit',
  it.realm_id,
  it.client_id,
  'full',
  'com.intuit.quickbooks.accounting openid',
  it.access_token_encrypted, it.refresh_token_encrypted,
  it.access_token_expires_at, it.refresh_token_expires_at,
  it.last_refreshed_at, it.created_at, it.updated_at
FROM "intuit_tokens" it
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'alfredo@pixvector.mx');
--> statement-breakpoint

-- Llenar user_client_access para alfredo con TODOS los clients
-- existentes. Cualquier user nuevo que se cree después se llena
-- manualmente vía SQL (D-mapi-023: sin endpoint admin en v0.8.0).
INSERT INTO "user_client_access" ("user_id", "client_id")
SELECT
  (SELECT id FROM users WHERE email = 'alfredo@pixvector.mx' LIMIT 1),
  c.id
FROM "clients" c
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'alfredo@pixvector.mx')
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- D-mapi-027: intuit_tokens NO se dropea, se renombra a deprecated.
-- Drop real en v0.8.1 después de validar 2 semanas en prod.
ALTER TABLE "intuit_tokens" RENAME TO "intuit_tokens_deprecated";