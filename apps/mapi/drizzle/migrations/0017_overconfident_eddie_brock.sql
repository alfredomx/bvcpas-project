ALTER TABLE "user_connections" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_connections" ADD COLUMN "paused_reason" text;