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

const { auth, requireAdmin, requireAdminOrStaff } = require("../middleware/auth")

const router = express.Router()

// Literal routes must stay above the "/:productId" wildcard below,
// otherwise Express would match them as a productId instead.
router.get("/search", searchProducts)
router.get("/categories", getCategories)
router.get("/filter", filterProducts)
router.get("/best-sellers", getBestSellers)
router.get("/", getProducts)
router.get("/:productId", getProductById)

const { upload } = require("../middleware/upload")

// Write routes — admin + staff may add/edit; only admin may delete a product.
router.post(
  "/",
  auth,
  requireAdminOrStaff,
  upload.single("image"),
  addProduct
)

router.put(
  "/:productId",
  auth,
  requireAdminOrStaff,
  upload.single("image"),
  updateProduct
)

router.delete(
  "/:productId",
  auth,
  requireAdmin,
  deleteProduct
)

// Product image endpoints (color-keyed, H&M-style)
router.get("/:productId/images", getProductImages)
router.post("/:productId/images", auth, requireAdminOrStaff, upload.single("image"), addProductImage)
router.delete("/:productId/images/:imageId", auth, requireAdminOrStaff, deleteProductImage)
router.put("/:productId/images/:imageId/primary", auth, requireAdminOrStaff, setPrimaryImage)

router.get("/:productId/reviews", getProductReviews)

module.exports = router
