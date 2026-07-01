const pool = require("../db")

// GET /products/:productId/images
// Returns all images for a product ordered by color then sort_order.
// Storefront uses this to build the color→images map.
const getProductImages = async (req, res) => {
  try {
    const { productId } = req.params
    const result = await pool.query(
      `SELECT image_id, product_id, color, image_url, alt_text, is_primary, sort_order
       FROM product_images
       WHERE product_id = $1
       ORDER BY COALESCE(color, '') ASC, is_primary DESC, sort_order ASC, image_id ASC`,
      [productId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error("GET IMAGES ERROR:", err.message)
    res.status(500).json({ error: "Server error" })
  }
}

// POST /products/:productId/images
// Upload a new image for a product. Body fields: color (optional), sort_order (optional).
// Becomes is_primary automatically if the product has no primary image yet.
const addProductImage = async (req, res) => {
  try {
    const { productId } = req.params
    const { color, sort_order } = req.body

    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" })
    }

    const image_url = `http://localhost:5000/uploads/${req.file.filename}`

    const primaryCheck = await pool.query(
      `SELECT 1 FROM product_images WHERE product_id = $1 AND is_primary = TRUE`,
      [productId]
    )
    const isPrimary = primaryCheck.rows.length === 0

    const result = await pool.query(
      `INSERT INTO product_images (product_id, color, image_url, is_primary, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING image_id, product_id, color, image_url, is_primary, sort_order`,
      [productId, color || null, image_url, isPrimary, Number(sort_order) || 0]
    )

    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error("ADD IMAGE ERROR:", err.message)
    res.status(500).json({ error: "Server error" })
  }
}

// DELETE /products/:productId/images/:imageId
// Deletes an image. If it was the primary, promotes the next image to primary.
const deleteProductImage = async (req, res) => {
  try {
    const { productId, imageId } = req.params

    const deleted = await pool.query(
      `DELETE FROM product_images
       WHERE image_id = $1 AND product_id = $2
       RETURNING image_id, is_primary`,
      [imageId, productId]
    )

    if (deleted.rows.length === 0) {
      return res.status(404).json({ error: "Image not found" })
    }

    if (deleted.rows[0].is_primary) {
      // Promote the next available image so getProducts still has a thumbnail
      await pool.query(
        `UPDATE product_images SET is_primary = TRUE
         WHERE image_id = (
           SELECT image_id FROM product_images
           WHERE product_id = $1
           ORDER BY sort_order ASC, image_id ASC
           LIMIT 1
         )`,
        [productId]
      )
    }

    res.json({ message: "Image deleted" })
  } catch (err) {
    console.error("DELETE IMAGE ERROR:", err.message)
    res.status(500).json({ error: "Server error" })
  }
}

// PUT /products/:productId/images/:imageId/primary
// Switches which image is the product thumbnail (the one getProducts shows on the card).
const setPrimaryImage = async (req, res) => {
  try {
    const { productId, imageId } = req.params

    // Clear existing primary then set the new one in two separate statements to
    // avoid a momentary constraint violation (partial unique index on is_primary=TRUE).
    await pool.query(
      `UPDATE product_images SET is_primary = FALSE WHERE product_id = $1`,
      [productId]
    )

    const result = await pool.query(
      `UPDATE product_images SET is_primary = TRUE
       WHERE image_id = $1 AND product_id = $2
       RETURNING image_id`,
      [imageId, productId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Image not found" })
    }

    res.json({ message: "Primary image updated" })
  } catch (err) {
    console.error("SET PRIMARY ERROR:", err.message)
    res.status(500).json({ error: "Server error" })
  }
}

module.exports = { getProductImages, addProductImage, deleteProductImage, setPrimaryImage }
