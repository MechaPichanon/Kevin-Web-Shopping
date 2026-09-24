const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/auth");
const { validateDiscount } = require("../controllers/discountControllers");

router.post("/validate", auth, validateDiscount);

module.exports = router;
