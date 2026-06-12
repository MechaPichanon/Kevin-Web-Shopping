const express = require("express");

const router = express.Router();

const {
  addToCart,
  getCart,
} = require("../controllers/cartControllers");

router.post("/add", addToCart);

router.get("/:user_id", getCart);

module.exports = router;