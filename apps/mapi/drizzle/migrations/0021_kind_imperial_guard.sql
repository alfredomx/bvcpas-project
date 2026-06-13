ALTER TABLE "client_bank_accounts" DROP CONSTRAINT "client_bank_accounts_client_portal_unique";--> statement-breakpoint
ALTER TABLE "client_bank_accounts" ADD COLUMN "nickname" text;