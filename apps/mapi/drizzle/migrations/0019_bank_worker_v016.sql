CREATE TABLE "bank_portals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"portal_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_portals_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "client_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"bank_portal_id" uuid NOT NULL,
	"username_encrypted" text NOT NULL,
	"password_encrypted" text NOT NULL,
	"security_qa_encrypted" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_bank_accounts_client_portal_unique" UNIQUE("client_id","bank_portal_id")
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_bank_account_id" uuid NOT NULL,
	"account_mask" varchar(4) NOT NULL,
	"account_type" varchar(20) NOT NULL,
	"label" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_accounts_login_mask_unique" UNIQUE("client_bank_account_id","account_mask")
);
--> statement-breakpoint
DROP INDEX IF EXISTS "users_status_role_idx";--> statement-breakpoint
ALTER TABLE "client_bank_accounts" ADD CONSTRAINT "client_bank_accounts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_bank_accounts" ADD CONSTRAINT "client_bank_accounts_bank_portal_id_bank_portals_id_fk" FOREIGN KEY ("bank_portal_id") REFERENCES "public"."bank_portals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_client_bank_account_id_client_bank_accounts_id_fk" FOREIGN KEY ("client_bank_account_id") REFERENCES "public"."client_bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";