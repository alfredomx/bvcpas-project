CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_credential_id" uuid NOT NULL,
	"account_mask" varchar(4) NOT NULL,
	"account_type" varchar(20) NOT NULL,
	"label" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_accounts_credential_mask_unique" UNIQUE("bank_credential_id","account_mask")
);
--> statement-breakpoint
CREATE TABLE "bank_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"bank_portal_id" uuid NOT NULL,
	"nickname" text,
	"username_encrypted" text,
	"password_encrypted" text,
	"security_qa_encrypted" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_portals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"portal_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_portals_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_bank_credential_id_bank_credentials_id_fk" FOREIGN KEY ("bank_credential_id") REFERENCES "public"."bank_credentials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_credentials" ADD CONSTRAINT "bank_credentials_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_credentials" ADD CONSTRAINT "bank_credentials_bank_portal_id_bank_portals_id_fk" FOREIGN KEY ("bank_portal_id") REFERENCES "public"."bank_portals"("id") ON DELETE restrict ON UPDATE no action;