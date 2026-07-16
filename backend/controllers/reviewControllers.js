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

module.exports = { getProductReviews }
