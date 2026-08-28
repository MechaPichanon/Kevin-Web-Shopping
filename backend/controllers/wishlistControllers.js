// controllers/wishlistController.js
const db = require("../db")

// GET /wishlist/my — ดึง wishlist ของ user ที่ login อยู่
const getMyWishlist = async (req, res) => {
    try {
        const user_id = req.user.id

        const result = await db.query(
            `SELECT
     w.product_id,
     w.added_at,
     p.product_name,
     p.category,
     MIN(v.price) AS price,
     pi.image_url
   FROM wishlist w
   JOIN products p ON p.product_id = w.product_id
   LEFT JOIN variants v ON v.product_id = p.product_id AND v.is_active = TRUE
   LEFT JOIN product_images pi
     ON pi.product_id = p.product_id AND pi.is_primary = TRUE
   WHERE w.user_id = $1
   GROUP BY w.product_id, w.added_at,
            p.product_name, p.category, pi.image_url
   ORDER BY w.added_at DESC`,
            [user_id]

        )
        res.json(result.rows)
    } catch (err) {
        console.error("GET WISHLIST ERROR:", err.message)
        res.status(500).json({ error: "Server Error" })
    }
}

// POST /wishlist — เพิ่มสินค้าเข้า wishlist
const addToWishlist = async (req, res) => {
    try {
        const user_id = req.user.id
        const { product_id } = req.body

        if (!product_id) {
            return res.status(400).json({ error: "product_id is required" })
        }

        await db.query(
            `INSERT INTO wishlist (user_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, product_id) DO NOTHING`,
            [user_id, product_id]
        )

        res.json({ success: true })
    } catch (err) {
        console.error("ADD WISHLIST ERROR:", err.message)
        res.status(500).json({ error: "Server Error" })
    }
}

// DELETE /wishlist/:product_id — ลบสินค้าออกจาก wishlist
const removeFromWishlist = async (req, res) => {
    try {
        const user_id = req.user.id
        const { product_id } = req.params

        await db.query(
            `DELETE FROM wishlist
       WHERE user_id = $1 AND product_id = $2`,
            [user_id, product_id]
        )

        res.json({ success: true })
    } catch (err) {
        console.error("REMOVE WISHLIST ERROR:", err.message)
        res.status(500).json({ error: "Server Error" })
    }
}

module.exports = { getMyWishlist, addToWishlist, removeFromWishlist }