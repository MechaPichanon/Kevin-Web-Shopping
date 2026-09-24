const express = require("express");

const router = express.Router();

const {
  getDiscounts,
  createDiscount,
  toggleDiscount,
  deleteDiscount,
} = require("../controllers/adminDiscountController");

router.get("/admin/discounts", getDiscounts);

router.post("/admin/discounts", createDiscount);

router.patch("/admin/discounts/:id/toggle", toggleDiscount);

router.delete("/admin/discounts/:id", deleteDiscount);

module.exports = router;