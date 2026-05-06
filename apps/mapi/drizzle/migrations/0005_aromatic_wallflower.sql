CREATE TABLE "user_microsoft_tokens" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"microsoft_user_id" text NOT NULL,
	"email" text NOT NULL,
	"scopes" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"last_refreshed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_microsoft_tokens_microsoft_user_id_unique" UNIQUE("microsoft_user_id")
);
--> statement-breakpoint
ALTER TABLE "user_microsoft_tokens" ADD CONSTRAINT "user_microsoft_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;