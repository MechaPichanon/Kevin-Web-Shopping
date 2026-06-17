const express = require("express")

const {
  getProducts,
  addProduct,
} = require("../controllers/productControllers")

const router = express.Router()

router.get("/", getProducts)

const multer = require("multer")
const path = require("path")

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/")
  },

  filename: (req, file, cb) => {
    cb(
      null,
      Date.now() +
      path.extname(file.originalname)
    )
  },
})

const upload = multer({ storage })

router.post(
  "/",
  upload.single("image"),
  addProduct
)

module.exports = router
