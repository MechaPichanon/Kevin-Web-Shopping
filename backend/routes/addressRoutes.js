// routes/addressRoutes.js
const express = require("express")
const router = express.Router()
const { auth } = require("../middleware/auth")
const {
  listMyAddresses,
  createAddress,
  updateAddress,
  makeDefaultAddress,
  deleteAddress,
} = require("../controllers/addressControllers")

router.get("/", auth, listMyAddresses)
router.post("/", auth, createAddress)
router.put("/:id", auth, updateAddress)
router.patch("/:id/default", auth, makeDefaultAddress)
router.delete("/:id", auth, deleteAddress)

module.exports = router
