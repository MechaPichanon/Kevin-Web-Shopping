const crypto = require("crypto")
const db = require("../db")

function buildChunkText({ product_name, category, sub_category, description, price, size, color }) {
  const lines = [
    `Name: ${product_name || ""}`,
    `Category: ${category || ""}`,
    sub_category  ? `Sub-category: ${sub_category}`     : null,
    price != null ? `Price: ${price} THB`               : null,
    size          ? `Sizes: ${size}`                    : null,
    color         ? `Colors: ${color}`                  : null,
    description   ? `Description: ${description}`       : null,
  ].filter(Boolean)
  return lines.join("\n").trim()
}

async function generateAndStoreEmbedding(productId, content) {
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "")
  const model   = process.env.OLLAMA_EMBED_MODEL || "bge-m3"

  const res = await fetch(`${baseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: content }),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`)

  const data = await res.json()
  if (!Array.isArray(data.embedding)) throw new Error("Ollama response missing embedding array")

  const vec  = `[${data.embedding.join(",")}]`
  const hash = crypto.createHash("sha256").update(content, "utf8").digest("hex")

  await db.query(
    `UPDATE product_chunks
     SET embedding    = $2::vector(1024),
         embed_model  = $3,
         embedded_at  = NOW(),
         content_hash = $4
     WHERE product_id = $1 AND chunk_index = 0`,
    [productId, vec, model, hash]
  )
}

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
    const chunkContent = buildChunkText({ product_name, category, sub_category, description, price, size, color })

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

    await client.query(
      `INSERT INTO product_chunks (product_id, chunk_index, content)
       VALUES ($1, 0, $2)
       ON CONFLICT (product_id, chunk_index) DO UPDATE SET
         content      = EXCLUDED.content,
         content_hash = '',
         embedded_at  = NULL`,
      [productId, chunkContent]
    )

    await client.query("COMMIT")

    res.status(201).json({
      message: "เพิ่มสินค้าสำเร็จ",
    })

    generateAndStoreEmbedding(productId, chunkContent).catch((err) =>
      console.error("[embed] failed for", productId, err.message)
    )
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

const updateProduct = async (req, res) => {
  let client

  try {
    const { productId, variantId } = req.params
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

    const chunkContent = buildChunkText({ product_name, category, sub_category, description, price, size, color })

    client = await db.connect()
    await client.query("BEGIN")

    const productResult = await client.query(
      `
      UPDATE products
      SET
        product_name = $1,
        category = $2,
        sub_category = $3,
        description = $4,
        updated_at = NOW()
      WHERE product_id = $5
      RETURNING product_id
      `,
      [
        product_name,
        category,
        sub_category,
        description,
        productId,
      ]
    )

    if (productResult.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(404).json({
        error: "Product not found",
      })
    }

    const variantResult = await client.query(
      `
      UPDATE variants
      SET
        size = $1,
        color = $2,
        pattern = $3,
        price = $4,
        stock = $5
      WHERE variant_id = $6
      AND product_id = $7
      RETURNING variant_id
      `,
      [
        size,
        color,
        pattern,
        price,
        stock,
        variantId,
        productId,
      ]
    )

    if (variantResult.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(404).json({
        error: "Variant not found",
      })
    }

    if (image_url) {
      const imageResult = await client.query(
        `
        UPDATE product_images
        SET
          variant_id = $1,
          image_url = $2,
          is_primary = true,
          sort_order = 0
        WHERE product_id = $3
        AND is_primary = true
        RETURNING image_id
        `,
        [
          variantId,
          image_url,
          productId,
        ]
      )

      if (imageResult.rowCount === 0) {
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
          VALUES ($1, $2, $3, true, 0)
          `,
          [
            productId,
            variantId,
            image_url,
          ]
        )
      }
    }

    await client.query(
      `INSERT INTO product_chunks (product_id, chunk_index, content)
       VALUES ($1, 0, $2)
       ON CONFLICT (product_id, chunk_index) DO UPDATE SET
         content      = EXCLUDED.content,
         content_hash = '',
         embedded_at  = NULL`,
      [productId, chunkContent]
    )

    await client.query("COMMIT")

    res.json({
      message: "Product updated successfully",
    })

    generateAndStoreEmbedding(productId, chunkContent).catch((err) =>
      console.error("[embed] failed for", productId, err.message)
    )
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

const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params

    const result = await db.query(
      `
      DELETE FROM products
      WHERE product_id = $1
      RETURNING product_id
      `,
      [productId]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Product not found",
      })
    }

    res.json({
      message: "Product deleted successfully",
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
  updateProduct,
  deleteProduct,
}
