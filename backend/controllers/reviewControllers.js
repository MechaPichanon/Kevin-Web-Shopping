const db = require("../db")

// GET /products/:productId/reviews
// Returns approved reviews for a product plus an aggregate rating summary.
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params

    const [summaryResult, reviewsResult] = await Promise.all([
      db.query(
        `SELECT
           COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS avg_rating,
           COUNT(*)::int AS review_count
         FROM reviews
         WHERE product_id = $1 AND is_approved = TRUE`,
        [productId]
      ),
      db.query(
        `SELECT
           r.review_id,
           r.rating,
           r.title,
           r.body,
           r.created_at,
           u.username,
           u.first_name,
           u.last_name
         FROM reviews r
         JOIN users u ON u.id = r.user_id
         WHERE r.product_id = $1 AND r.is_approved = TRUE
         ORDER BY r.created_at DESC`,
        [productId]
      ),
    ])

    res.json({
      avg_rating: Number(summaryResult.rows[0].avg_rating),
      review_count: summaryResult.rows[0].review_count,
      reviews: reviewsResult.rows,
    })
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Server error" })
  }
}

// POST /reviews  { product_id, order_id, rating, title, body }
// Only lets a user review a product from an order that's actually theirs
// and actually contains that product — otherwise anyone with a product_id
// could post a review with no purchase at all.
const createReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, order_id, rating, title, body } = req.body;

    if (!product_id || !order_id || !rating) {
      return res.status(400).json({ error: "ข้อมูลไม่ครบ" });
    }

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "คะแนนต้องอยู่ระหว่าง 1-5" });
    }

    // Confirm this order belongs to the user, contains this product, and is
    // actually confirmed — otherwise skip straight to "not eligible".
    const eligible = await db.query(
      `
      SELECT 1
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id
      JOIN variants v ON v.variant_id = oi.variant_id
      WHERE o.order_id = $1
        AND o.user_id = $2
        AND v.product_id = $3
        AND o.status = 'confirmed'
      LIMIT 1
      `,
      [order_id, userId, product_id]
    );

    if (eligible.rows.length === 0) {
      return res.status(403).json({
        error: "คุณสามารถรีวิวได้เฉพาะสินค้าที่ซื้อและได้รับแล้วเท่านั้น",
      });
    }

    const result = await db.query(
      `
      INSERT INTO reviews (product_id, user_id, order_id, rating, title, body, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING review_id, product_id, order_id, rating, title, body, is_approved, created_at
      `,
      [product_id, userId, order_id, ratingNum, title || null, body || null, true]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "คุณรีวิวสินค้านี้จากคำสั่งซื้อนี้ไปแล้ว" });
    }
    console.log(err);
    res.status(500).json({ error: "Server Error" });
  }
};

// GET /reviews/mine — { product_id, order_id } pairs the logged-in user has
// already reviewed, so the frontend can grey out "รีวิวสินค้า" per item.
const getMyReviewedItems = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT product_id, order_id FROM reviews WHERE user_id = $1`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server Error" });
  }
};

module.exports = { getProductReviews, createReview, getMyReviewedItems }ห