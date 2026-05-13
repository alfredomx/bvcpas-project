-- v0.13.0: silent_streak operativo + last_fully_responded_at
--
-- 1. Agrega columna last_fully_responded_at a client_period_followups.
-- 2. Backfill: para cada (cliente, período) que está al 100% hoy, set NOW().
--
-- Comparación por período mensual ('YYYY-MM' derivado del txn_date).

ALTER TABLE "client_period_followups" ADD COLUMN "last_fully_responded_at" timestamp with time zone;
--> statement-breakpoint

UPDATE "client_period_followups" f
SET "last_fully_responded_at" = NOW()
WHERE (
  SELECT COUNT(*) FROM "client_transactions" t
  WHERE t."client_id" = f."client_id"
    AND t."category" IN ('uncategorized_expense', 'uncategorized_income')
    AND TO_CHAR(t."txn_date", 'YYYY-MM') = f."period"
) > 0
AND (
  SELECT COUNT(*) FROM "client_transactions" t
  WHERE t."client_id" = f."client_id"
    AND t."category" IN ('uncategorized_expense', 'uncategorized_income')
    AND TO_CHAR(t."txn_date", 'YYYY-MM') = f."period"
) <= (
  SELECT COUNT(*) FROM "client_transaction_responses" r
  WHERE r."client_id" = f."client_id"
    AND r."completed" = true
    AND r."deleted_at" IS NULL
    AND r."category" IN ('uncategorized_expense', 'uncategorized_income')
    AND TO_CHAR(r."txn_date", 'YYYY-MM') = f."period"
);
