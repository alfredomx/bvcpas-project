ALTER TABLE "bank_portals" ALTER COLUMN "portal_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "client_bank_accounts" ALTER COLUMN "username_encrypted" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "client_bank_accounts" ALTER COLUMN "password_encrypted" DROP NOT NULL;