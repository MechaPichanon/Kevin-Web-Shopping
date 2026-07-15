const express = require("express");

const router = express.Router();

const {
  addToCart,
  getCart,
  updateCartQuantity,
  removeCartItem,
  clearCart,
} = require("../controllers/cartControllers");

router.post("/add", addToCart);

router.get("/:user_id", getCart);

// เปลี่ยนจำนวนสินค้า
router.put("/:cart_item_id", updateCartQuantity);

// ลบสินค้า
router.delete("/:cart_item_id", removeCartItem);

// ล้างตะกร้า
router.delete("/clear/:user_id", clearCart);

module.exports = router;