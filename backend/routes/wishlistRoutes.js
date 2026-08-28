// routes/wishlistRoutes.js
const express = require("express")
const router = express.Router()
const { auth } = require("../middleware/auth")
const {
  getMyWishlist,
  addToWishlist,
  removeFromWishlist,
} = require("../controllers/wishlistControllers")

router.get("/my", auth, getMyWishlist)
router.post("/", auth, addToWishlist)
router.delete("/:product_id", auth, removeFromWishlist)

module.exports = router