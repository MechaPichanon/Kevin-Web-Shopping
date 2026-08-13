const express = require("express");
const router = express.Router();

const { auth, requireAdmin } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const {
  createOrder,
  getMyOrders,
  getMyOrderById,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  uploadPaymentSlip,
} = require("../controllers/orderControllers");

router.post("/create", createOrder);
router.post("/:id/payment-slip", upload.single("slip"), uploadPaymentSlip);

// Customer — logged-in user's own orders
router.get("/my", auth, getMyOrders);
router.get("/my/:id", auth, getMyOrderById);

// Admin
router.get("/admin", auth, requireAdmin, getAllOrders);
router.get("/admin/:id", auth, requireAdmin, getOrderById);
router.patch("/admin/:id/status", auth, requireAdmin, updateOrderStatus);
router.patch("/admin/:id/payment-status", auth, requireAdmin, updatePaymentStatus);

module.exports = router;
