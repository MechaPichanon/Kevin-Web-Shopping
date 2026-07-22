const express = require("express")

const {
  getProducts,
  getProductById,
  searchProducts,
  getCategories,
  filterProducts,
  getBestSellers,
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

const { getProductReviews } = require("../controllers/reviewControllers")

const router = express.Router()

// Literal routes must stay above the "/:productId" wildcard below,
// otherwise Express would match them as a productId instead.
router.get("/search", searchProducts)
router.get("/categories", getCategories)
router.get("/filter", filterProducts)
router.get("/best-sellers", getBestSellers)
router.get("/", getProducts)
router.get("/:productId", getProductById)

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

router.get("/:productId/reviews", getProductReviews)

module.exports = router
