-- 026_drop_orders_payment_slip_url.sql
-- Step 2: drop orders.payment_slip_url. Run AFTER 025_ and after the backend
-- no longer reads/writes it (the latest slip is now derived from
-- payment_slips, ORDER BY uploaded_at DESC, slip_id DESC).
--
-- The column only ever held ONE url per order, while an order can have many
-- slips (rejected, then re-uploaded) — payment_slips already keeps every one
-- with its status/reason/reviewer, so the column was a redundant copy.
--
-- Guard: refuse to drop if any order's url is missing from payment_slips
-- (i.e. 025_ was skipped), so no slip is silently lost.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'orders' AND column_name = 'payment_slip_url') THEN
    IF EXISTS (
      SELECT 1 FROM orders o
      WHERE o.payment_slip_url IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM payment_slips ps
                        WHERE ps.order_id = o.order_id
                          AND ps.slip_url = o.payment_slip_url)
    ) THEN
      RAISE EXCEPTION 'orders.payment_slip_url holds urls not in payment_slips — run 025_ first';
    END IF;
  END IF;
END
$$;

ALTER TABLE orders DROP COLUMN IF EXISTS payment_slip_url;
