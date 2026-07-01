const express = require("express")

const {
  getProducts,
  searchProducts,
  getCategories,
  filterProducts,
  addProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productControllers")

const {
  getProductImages,
  addProductImage,
  deleteProductImage,
  setPrimaryImage,
} = require("../controllers/productImageControllers")

const router = express.Router()

router.get("/search", searchProducts)
router.get("/categories", getCategories)
router.get("/filter", filterProducts)
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

router.put(
  "/:productId",
  upload.single("image"),
  updateProduct
)

router.delete(
  "/:productId",
  deleteProduct
)

// Product image endpoints (color-keyed, H&M-style)
router.get("/:productId/images", getProductImages)
router.post("/:productId/images", upload.single("image"), addProductImage)
router.delete("/:productId/images/:imageId", deleteProductImage)
router.put("/:productId/images/:imageId/primary", setPrimaryImage)

module.exports = router
