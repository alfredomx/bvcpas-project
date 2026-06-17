CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" varchar(200) NOT NULL,
	"dba" varchar(200),
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "clients_status_legal_name_idx" ON "clients" USING btree ("status","legal_name");