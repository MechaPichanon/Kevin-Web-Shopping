const express = require("express");
const router = express.Router();

const { auth, requireAdminOrStaff } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const {
  createOrder,
  getMyOrders,
  getMyOrderById,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderTracking,
  updatePaymentStatus,
  uploadPaymentSlip,
  customerReuploadPaymentSlip,
  cancelMyOrder,
} = require("../controllers/orderControllers");

router.post("/create", createOrder);
router.post("/:id/payment-slip", upload.single("slip"), uploadPaymentSlip);

// Customer — logged-in user's own orders
router.get("/my", auth, getMyOrders);
router.get("/my/:id", auth, getMyOrderById);
router.post("/my/:id/payment-slip", auth, upload.single("slip"), customerReuploadPaymentSlip);
router.patch("/my/:id/cancel", auth, cancelMyOrder);

// Admin + staff — staff run fulfillment (status) and payment verification
router.get("/admin", auth, requireAdminOrStaff, getAllOrders);
router.get("/admin/:id", auth, requireAdminOrStaff, getOrderById);
router.patch("/admin/:id/status", auth, requireAdminOrStaff, updateOrderStatus);
router.patch("/admin/:id/tracking", auth, requireAdminOrStaff, updateOrderTracking);
router.patch("/admin/:id/payment-status", auth, requireAdminOrStaff, updatePaymentStatus);

module.exports = router;
