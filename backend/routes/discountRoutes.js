const express = require("express");
const router = express.Router();

const { validateDiscount } = require("../controllers/discountControllers");

router.post("/validate", validateDiscount);

module.exports = router;