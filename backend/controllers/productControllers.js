const db = require("../db")

const getProducts = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        p.product_id,
        p.product_name,
        p.category,
        p.sub_category,
        p.description,

        pv.variant_id,
        pv.size,
        pv.color,
        pv.pattern,
        pv.price,
        pv.stock

      FROM products p

      LEFT JOIN variants pv
      ON p.product_id = pv.product_id

      ORDER BY p.created_at DESC
    `)

    res.json(result.rows)
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: "Server error",
    })
  }
}

const addProduct = async (req, res) => {
  try {
    const {
      product_name,
      category,
      sub_category,
      description,

      size,
      color,
      pattern,

      price,
      stock,
    } = req.body

    const productId = "P" + Date.now()
    const variantId = "V" + Date.now()

    await db.query(
      `
      INSERT INTO products
      (
        product_id,
        product_name,
        category,
        sub_category,
        description
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        productId,
        product_name,
        category,
        sub_category,
        description,
      ]
    )

    await db.query(
      `
      INSERT INTO variants
      (
        variant_id,
        product_id,
        size,
        color,
        pattern,
        price,
        stock
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        variantId,
        productId,
        size,
        color,
        pattern,
        price,
        stock,
      ]
    )

    res.status(201).json({
      message: "เพิ่มสินค้าสำเร็จ",
    })
  } catch (err) {
    console.log(err)

    res.status(500).json({
      error: "Server error",
    })
  }
}

module.exports = {
  getProducts,
  addProduct,
}
