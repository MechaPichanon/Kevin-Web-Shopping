const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/auth");
const { createReview, getMyReviewedItems } = require("../controllers/reviewControllers");

// getProductReviews stays mounted wherever it already is (routes/productRoutes.js,
// as GET /products/:productId/reviews) — not duplicated here.
router.post("/", auth, createReview);
router.get("/mine", auth, getMyReviewedItems);

module.exports = router;