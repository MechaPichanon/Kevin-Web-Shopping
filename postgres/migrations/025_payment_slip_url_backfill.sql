-- 025_payment_slip_url_backfill.sql
-- Step 1 of making payment_slips the ONLY store of payment-slip URLs (026_
-- drops orders.payment_slip_url). Safe to re-run, and a no-op once 026_ has
-- been applied.
--
-- 017_ backfilled one payment_slips row only for orders that had NO slip row
-- at all. This covers the remaining gap: an order whose payment_slip_url is
-- not any of its payment_slips rows. Such a URL is copied in as a slip row
-- (status derived from the order, same rule as 017_) so no slip is lost when
-- the column is dropped.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'orders' AND column_name = 'payment_slip_url') THEN
    INSERT INTO payment_slips (order_id, slip_url, status, uploaded_at)
    SELECT o.order_id, o.payment_slip_url,
           CASE
             WHEN o.payment_status = 'paid'     THEN 'approved'
             WHEN o.payment_status = 'rejected' THEN 'rejected'
             ELSE 'pending_verification'
           END,
           COALESCE(o.updated_at, o.ordered_at)
    FROM orders o
    WHERE o.payment_slip_url IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM payment_slips ps
                      WHERE ps.order_id = o.order_id
                        AND ps.slip_url = o.payment_slip_url);
  END IF;
END
$$;
