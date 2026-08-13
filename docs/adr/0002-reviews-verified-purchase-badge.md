# Verified Purchase is a badge, not a submission gate; moderation is hybrid

Any logged-in user may submit a review — `reviews.order_id` is nullable by design (`postgres/init/01_schema.sql:324`, "verified purchase optional"), so submission is not gated on having bought the product. This corrects an earlier draft of this ADR that proposed mandatory purchase-gating without checking the schema first.

If the reviewer has a paid order containing the product, the review links to it and is marked as a Verified Purchase. Moderation is hybrid: verified-purchase reviews auto-approve (`is_approved = TRUE` at insert), since a completed order is itself a strong trust signal; unverified reviews default to `is_approved = FALSE` and wait in an admin moderation queue before appearing on `GET /products/:productId/reviews` (which already only returns approved reviews). This keeps the existing schema default intact for the unverified case while not forcing every review through manual review.
