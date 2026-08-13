# Payment verification — current state & recommendations for future implementation

Written after auditing the admin orders flow (2026-07-20). This is a punch list for
later, not a spec to build against immediately — scope is a bachelor thesis demo,
not a production payment system.

## Current state

- Checkout (`POST /orders/create`, `backend/controllers/orderControllers.js:3-174`)
  creates the order with `payment_status = 'unpaid'` (schema default) and a
  `payments` row. `POST /promptpay` (`backend/routes/payment.js`) generates a
  PromptPay QR code for the customer to pay with, but only returns the QR image —
  it never touches the database, so nothing ever confirms the customer actually paid.
- The admin orders page (`frontend/app/admin/orders/page.tsx`) already has UI for a
  slip-verification workflow: "ยืนยันการชำระ" (confirm) / "สลิปไม่ถูกต้อง" (reject)
  buttons that only appear when `paymentStatus === 'pending_verification'`, and call
  `PATCH /orders/admin/:id/payment-status` with `paid` or `rejected`.
- Migration `009_expand_payment_status.sql` widened `orders.payment_status`'s CHECK
  constraint to accept `pending_verification` and `rejected`, so those two admin
  actions no longer fail at the DB level — but **nothing produces the
  `pending_verification` state**. The confirm/reject buttons are still unreachable
  in the live app because no code path ever sets that value.

In short: the admin-side half of "review a payment slip" exists; the customer-side
half ("upload a slip, mark it pending") does not.

## What's needed for a real (but still demo-scoped) flow

1. **Customer slip upload endpoint** — e.g. `POST /orders/:id/payment-slip`. Reuse
   the existing multer/`uploads/` pattern already used for product images
   (`backend/server.js:35-64`, `backend/routes/productRoutes.js:33-50`) rather than
   introducing a new upload mechanism. On success, `UPDATE orders SET
   payment_status = 'pending_verification' WHERE order_id = $1`.
2. **Store the slip image reference.** Simplest option: add a `payment_slip_url`
   column to `orders` (own migration, e.g. `010_add_payment_slip_url.sql`) rather
   than a new table — there's only ever one slip per order in this scope.
3. **Admin verify/reject** — no controller changes needed; `updateOrderStatus` /
   `updatePaymentStatus` (`backend/controllers/orderControllers.js:353-414`) already
   accept `paid` / `rejected` now that the constraint is widened.
4. **Auth hardening.** `orderRoutes.js` currently applies no middleware to any
   route — `GET /orders/admin`, `PATCH /orders/admin/:id/status`, and
   `PATCH /orders/admin/:id/payment-status` are all reachable without a token. Wrap
   the `/admin/*` routes with the same `auth, requireAdmin` middleware already used
   elsewhere in `backend/server.js` (e.g. lines 285, 300, 332) before relying on this
   for a real demo, since anyone can currently mark any order "paid."
5. **Server-side status validation.** `updateOrderStatus` / `updatePaymentStatus`
   pass `req.body` straight into the `UPDATE` and rely entirely on the Postgres
   CHECK constraint — an invalid value currently returns an opaque `500`. Add a
   small allow-list check (e.g. `['unpaid','pending_verification','paid','rejected','refunded'].includes(payment_status)`)
   and return `400` with a clear message on failure.

## Explicitly out of scope

No real payment gateway integration (Omise, 2C2P, Stripe, etc.), no webhook
verification, no automatic reconciliation. The manual "customer uploads a slip,
admin eyeballs it and clicks confirm/reject" flow above is enough for a thesis
demo and keeps the diff small.
