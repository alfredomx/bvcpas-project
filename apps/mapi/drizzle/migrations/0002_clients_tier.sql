ALTER TABLE "clients" ADD COLUMN "tier" varchar(20) DEFAULT 'silver' NOT NULL;
--> statement-breakpoint

-- CHECK tier enum (defensa en profundidad además del enum en drizzle).
ALTER TABLE "clients"
  ADD CONSTRAINT "clients_tier_check"
  CHECK ("tier" IN ('silver', 'gold', 'platinum'));
