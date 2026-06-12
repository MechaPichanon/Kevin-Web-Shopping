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
  pv.stock,

  pi.image_url

FROM products p

LEFT JOIN variants pv
ON p.product_id = pv.product_id

LEFT JOIN product_images pi
ON p.product_id = pi.product_id
AND pi.is_primary = true

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
  let client

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
    let image_url = null

    if (req.file) {
      image_url =
        `http://localhost:5000/uploads/${req.file.filename}`
    }
    const now = Date.now()
    const productId = "P" + now
    const variantId = "V" + now

    client = await db.connect()
    await client.query("BEGIN")
    await client.query(
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

    await client.query(
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
    if (image_url) {
      await client.query(
        `
    INSERT INTO product_images
    (
      product_id,
      variant_id,
      image_url,
      is_primary,
      sort_order
    )
    VALUES ($1,$2,$3,true,0)
    `,
        [
          productId,
          variantId,
          image_url,
        ]
      )
    }
    await client.query("COMMIT")

    res.status(201).json({
      message: "เพิ่มสินค้าสำเร็จ",
    })
  } catch (err) {
    if (client) {
      await client.query("ROLLBACK")
    }

    console.log(err)

    res.status(500).json({
      error: "Server error",
    })
  } finally {
    if (client) {
      client.release()
    }
  }
}

module.exports = {
  getProducts,
  addProduct,
}
