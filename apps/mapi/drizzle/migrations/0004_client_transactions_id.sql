ALTER TABLE "client_transactions" DROP CONSTRAINT "client_transactions_realm_id_qbo_txn_type_qbo_txn_id_pk";--> statement-breakpoint
ALTER TABLE "client_transactions" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "client_transactions_qbo_natural_key_idx" ON "client_transactions" USING btree ("realm_id","qbo_txn_type","qbo_txn_id");