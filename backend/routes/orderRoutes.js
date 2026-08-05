const express = require("express");
const router = express.Router();

const {
  createOrder,
  getMyOrders,
  getMyOrderById,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
} = require("../controllers/orderControllers");

const { auth, requireAdmin } = require("../middleware/auth");

router.post("/create", createOrder);

// Customer — logged-in user's own orders
router.get("/my", auth, getMyOrders);
router.get("/my/:id", auth, getMyOrderById);

// Admin — protected, same pattern as /users in server.js
router.get("/admin", auth, requireAdmin, getAllOrders);
router.get("/admin/:id", auth, requireAdmin, getOrderById);
router.patch("/admin/:id/status", auth, requireAdmin, updateOrderStatus);
router.patch("/admin/:id/payment-status", auth, requireAdmin, updatePaymentStatus);

module.exports = router;