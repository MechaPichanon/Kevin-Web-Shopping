const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();

const { auth, requireAdmin } = require("../middleware/auth");

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

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
