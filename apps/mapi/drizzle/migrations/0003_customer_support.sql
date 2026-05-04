CREATE TABLE "client_transactions" (
	"realm_id" text NOT NULL,
	"qbo_txn_type" text NOT NULL,
	"qbo_txn_id" text NOT NULL,
	"client_id" uuid NOT NULL,
	"txn_date" date NOT NULL,
	"docnum" text,
	"vendor_name" text,
	"memo" text,
	"split_account" text,
	"category" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_transactions_realm_id_qbo_txn_type_qbo_txn_id_pk" PRIMARY KEY("realm_id","qbo_txn_type","qbo_txn_id")
);
--> statement-breakpoint
CREATE TABLE "client_transaction_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"realm_id" text NOT NULL,
	"qbo_txn_type" text NOT NULL,
	"qbo_txn_id" text NOT NULL,
	"txn_date" date NOT NULL,
	"vendor_name" text,
	"memo" text,
	"split_account" text,
	"category" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"client_note" text NOT NULL,
	"responded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_to_qbo_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_period_followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"last_reply_at" timestamp with time zone,
	"sent_by_user_id" uuid,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_public_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"token" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	CONSTRAINT "client_public_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "draft_email_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "transactions_filter" varchar(20) DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "cc_email" text;--> statement-breakpoint
ALTER TABLE "client_transactions" ADD CONSTRAINT "client_transactions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_transaction_responses" ADD CONSTRAINT "client_transaction_responses_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_period_followups" ADD CONSTRAINT "client_period_followups_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_period_followups" ADD CONSTRAINT "client_period_followups_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_public_links" ADD CONSTRAINT "client_public_links_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_public_links" ADD CONSTRAINT "client_public_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_transaction_responses_unique_idx" ON "client_transaction_responses" USING btree ("client_id","realm_id","qbo_txn_type","qbo_txn_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_period_followups_unique_idx" ON "client_period_followups" USING btree ("client_id","period");--> statement-breakpoint

-- CHECK constraints (defensa en profundidad además del enum drizzle).
ALTER TABLE "clients"
  ADD CONSTRAINT "clients_transactions_filter_check"
  CHECK ("transactions_filter" IN ('all', 'income', 'expense'));
--> statement-breakpoint

ALTER TABLE "client_transactions"
  ADD CONSTRAINT "client_transactions_category_check"
  CHECK ("category" IN ('uncategorized_expense', 'uncategorized_income', 'ask_my_accountant'));
--> statement-breakpoint

ALTER TABLE "client_transaction_responses"
  ADD CONSTRAINT "client_transaction_responses_category_check"
  CHECK ("category" IN ('uncategorized_expense', 'uncategorized_income', 'ask_my_accountant'));
--> statement-breakpoint

ALTER TABLE "client_period_followups"
  ADD CONSTRAINT "client_period_followups_status_check"
  CHECK ("status" IN ('pending', 'ready_to_send', 'sent', 'awaiting_reply', 'partial_reply', 'complete', 'review_needed'));
--> statement-breakpoint

ALTER TABLE "client_public_links"
  ADD CONSTRAINT "client_public_links_purpose_check"
  CHECK ("purpose" IN ('uncats'));
--> statement-breakpoint

-- Índices auxiliares para queries comunes:
CREATE INDEX "client_transactions_client_date_idx"
  ON "client_transactions" ("client_id", "txn_date");
--> statement-breakpoint

CREATE INDEX "client_transaction_responses_client_idx"
  ON "client_transaction_responses" ("client_id", "txn_date");
--> statement-breakpoint

CREATE INDEX "client_transaction_responses_pending_writeback_idx"
  ON "client_transaction_responses" ("client_id")
  WHERE "synced_to_qbo_at" IS NULL;
--> statement-breakpoint

CREATE INDEX "client_public_links_active_idx"
  ON "client_public_links" ("client_id", "purpose")
  WHERE "revoked_at" IS NULL;
--> statement-breakpoint

-- Triggers updated_at:
CREATE OR REPLACE FUNCTION client_transaction_responses_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER client_transaction_responses_updated_at
BEFORE UPDATE ON client_transaction_responses
FOR EACH ROW
EXECUTE FUNCTION client_transaction_responses_set_updated_at();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION client_period_followups_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER client_period_followups_updated_at
BEFORE UPDATE ON client_period_followups
FOR EACH ROW
EXECUTE FUNCTION client_period_followups_set_updated_at();