CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" varchar(200) NOT NULL,
	"dba" varchar(200),
	"qbo_realm_id" text,
	"industry" varchar(80),
	"entity_type" varchar(40),
	"fiscal_year_start" smallint,
	"timezone" varchar(60),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"primary_contact_name" varchar(120),
	"primary_contact_email" varchar(255),
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_qbo_realm_id_unique" UNIQUE("qbo_realm_id")
);
--> statement-breakpoint
CREATE TABLE "intuit_tokens" (
	"client_id" uuid PRIMARY KEY NOT NULL,
	"realm_id" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"refresh_token_expires_at" timestamp with time zone NOT NULL,
	"last_refreshed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intuit_tokens_realm_id_unique" UNIQUE("realm_id")
);
--> statement-breakpoint
ALTER TABLE "intuit_tokens" ADD CONSTRAINT "intuit_tokens_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_status_legal_name_idx" ON "clients" USING btree ("status","legal_name");--> statement-breakpoint

-- CHECK status enum (defensa en profundidad además del enum en drizzle).
ALTER TABLE "clients"
  ADD CONSTRAINT "clients_status_check"
  CHECK ("status" IN ('active', 'paused', 'offboarded'));
--> statement-breakpoint

-- CHECK fiscal_year_start entre 1 y 12 (mes válido).
ALTER TABLE "clients"
  ADD CONSTRAINT "clients_fiscal_year_start_check"
  CHECK ("fiscal_year_start" IS NULL OR ("fiscal_year_start" >= 1 AND "fiscal_year_start" <= 12));
--> statement-breakpoint

-- Trigger updated_at en clients (mismo patrón que users).
CREATE OR REPLACE FUNCTION clients_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION clients_set_updated_at();
--> statement-breakpoint

-- Trigger updated_at en intuit_tokens.
CREATE OR REPLACE FUNCTION intuit_tokens_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER intuit_tokens_updated_at
BEFORE UPDATE ON intuit_tokens
FOR EACH ROW
EXECUTE FUNCTION intuit_tokens_set_updated_at();