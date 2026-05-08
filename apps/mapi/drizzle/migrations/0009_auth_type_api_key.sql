-- v0.11.0: agrega auth_type + credentials_encrypted para soportar
-- conexiones con credenciales estáticas (api_key) además de OAuth.
-- Las 8 rows existentes (Microsoft, Intuit, Dropbox, Google) reciben
-- auth_type='oauth' por DEFAULT — cero data migration.

ALTER TABLE "user_connections" ALTER COLUMN "scopes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_connections" ALTER COLUMN "access_token_encrypted" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_connections" ALTER COLUMN "access_token_expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_connections" ADD COLUMN "auth_type" text DEFAULT 'oauth' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_connections" ADD COLUMN "credentials_encrypted" text;--> statement-breakpoint

-- Constraints de integridad:
ALTER TABLE "user_connections"
  ADD CONSTRAINT "user_connections_auth_type_check"
  CHECK ("auth_type" IN ('oauth', 'api_key'));--> statement-breakpoint

ALTER TABLE "user_connections"
  ADD CONSTRAINT "user_connections_auth_type_consistency_check"
  CHECK (
    ("auth_type" = 'oauth' AND "access_token_encrypted" IS NOT NULL)
    OR
    ("auth_type" = 'api_key' AND "credentials_encrypted" IS NOT NULL)
  );
