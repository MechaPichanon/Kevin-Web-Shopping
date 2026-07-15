const express = require("express");
const router = express.Router();

const {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
} = require("../controllers/orderControllers");

router.post("/create", createOrder);
// Admin
router.get("/admin", getAllOrders);
router.get("/admin/:id", getOrderById);
router.patch("/admin/:id/status", updateOrderStatus);
router.patch("/admin/:id/payment-status", updatePaymentStatus);

module.exports = router;