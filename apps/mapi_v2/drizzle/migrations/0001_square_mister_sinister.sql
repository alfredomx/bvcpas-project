CREATE TABLE "intuit_tokens" (
	"client_id" uuid PRIMARY KEY NOT NULL,
	"realm_id" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"refresh_token_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intuit_tokens_realm_id_unique" UNIQUE("realm_id")
);
--> statement-breakpoint
ALTER TABLE "intuit_tokens" ADD CONSTRAINT "intuit_tokens_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;