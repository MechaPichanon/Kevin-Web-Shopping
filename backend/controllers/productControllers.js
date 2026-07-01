const crypto = require("crypto")
const db = require("../db")

function buildChunkText({ product_name, category, sub_category, description, price, size, color, sleeve, collar }) {
  const lines = [
    `Name: ${product_name || ""}`,
    `Category: ${category || ""}`,
    sub_category  ? `Sub-category: ${sub_category}`     : null,
    price != null ? `Price: ${price} THB`               : null,
    size          ? `Sizes: ${size}`                    : null,
    color         ? `Colors: ${color}`                  : null,
    sleeve        ? `Sleeve: ${sleeve}`                 : null,
    collar        ? `Collar: ${collar}`                 : null,
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

WHERE p.is_active = TRUE

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

const searchProducts = async (req, res) => {
  const { q } = req.query
  if (!q || !q.trim()) {
    return res.status(400).json({ error: "Missing search query" })
  }

  try {
    const term = `%${q.trim()}%`
    const result = await db.query(
      `
SELECT
  p.product_id,
  p.product_name,
  p.product_name_th,
  p.category,
  p.sub_category,
  p.description,
  pi.image_url,
  pv_rep.variant_id,
  pv_rep.price,
  pv_rep.stock

FROM products p

LEFT JOIN product_images pi
  ON p.product_id = pi.product_id
  AND pi.is_primary = TRUE

LEFT JOIN LATERAL (
  SELECT variant_id, price, stock
  FROM variants
  WHERE product_id = p.product_id
    AND is_active = TRUE
  ORDER BY price ASC
  LIMIT 1
) pv_rep ON TRUE

WHERE p.is_active = TRUE
  AND (
      p.product_name    ILIKE $1
   OR p.product_name_th ILIKE $1
   OR p.category        ILIKE $1
   OR p.category_th     ILIKE $1
   OR p.sub_category    ILIKE $1
   OR p.sub_category_th ILIKE $1
   OR p.description     ILIKE $1
   OR p.description_th  ILIKE $1
   OR EXISTS (
        SELECT 1 FROM variants pv
        WHERE pv.product_id = p.product_id
          AND pv.is_active = TRUE
          AND (
               pv.color      ILIKE $1
            OR pv.color_th   ILIKE $1
            OR pv.pattern    ILIKE $1
            OR pv.pattern_th ILIKE $1
            OR pv.sleeve     ILIKE $1
            OR pv.sleeve_th  ILIKE $1
            OR pv.collar     ILIKE $1
            OR pv.collar_th  ILIKE $1
          )
      )
  )

ORDER BY p.created_at DESC
      `,
      [term]
    )

    res.json(result.rows)
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Server error" })
  }
}

const addProduct = async (req, res) => {
  let client

  try {
    const {
      product_name,
      product_name_th,
      category,
      category_th,
      sub_category,
      sub_category_th,
      description,
      description_th,
      size,
      color,
      pattern,
      pattern_th,
      price,
      stock,
      color_th,
      chest_min,
      chest_max,
      waist_min,
      waist_max,
      sleeve,
      sleeve_th,
      collar,
      collar_th,
      cost_price,
      is_active,
    } = req.body
    let image_url = null

    if (req.file) {
      image_url =
        `http://localhost:5000/uploads/${req.file.filename}`
    }
    const now = Date.now()
    const productId = "P" + now
    const variantId = "V" + now
    const chunkContent = buildChunkText({ product_name, category, sub_category, description, price, size, color, sleeve, collar })

    client = await db.connect()
    await client.query("BEGIN")
    await client.query(
      `
      INSERT INTO products
      (
        product_id,
        product_name,
        product_name_th,
        category,
        category_th,
        sub_category,
        sub_category_th,
        description,
        description_th
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        productId,
        product_name,
        product_name_th || null,
        category,
        category_th || null,
        sub_category,
        sub_category_th || null,
        description,
        description_th || null,
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
        color_th,
        pattern,
        pattern_th,
        chest_min,
        chest_max,
        waist_min,
        waist_max,
        sleeve,
        sleeve_th,
        collar,
        collar_th,
        price,
        cost_price,
        stock,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      `,
      [
        variantId,
        productId,
        size,
        color,
        color_th || null,
        pattern,
        pattern_th || null,
        chest_min || null,
        chest_max || null,
        waist_min || null,
        waist_max || null,
        sleeve || null,
        sleeve_th || null,
        collar || null,
        collar_th || null,
        price,
        cost_price || null,
        stock,
        is_active !== "false",
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
      product_name_th,
      category,
      category_th,
      sub_category,
      sub_category_th,
      description,
      description_th,
      size,
      color,
      pattern,
      pattern_th,
      price,
      stock,
      color_th,
      chest_min,
      chest_max,
      waist_min,
      waist_max,
      sleeve,
      sleeve_th,
      collar,
      collar_th,
      cost_price,
      is_active,
    } = req.body

    let image_url = null

    if (req.file) {
      image_url =
        `http://localhost:5000/uploads/${req.file.filename}`
    }

    const chunkContent = buildChunkText({ product_name, category, sub_category, description, price, size, color, sleeve, collar })

    client = await db.connect()
    await client.query("BEGIN")

    const productResult = await client.query(
      `
      UPDATE products
      SET
        product_name    = $1,
        product_name_th = $2,
        category        = $3,
        category_th     = $4,
        sub_category    = $5,
        sub_category_th = $6,
        description     = $7,
        description_th  = $8,
        updated_at      = NOW()
      WHERE product_id = $9
      RETURNING product_id
      `,
      [
        product_name,
        product_name_th || null,
        category,
        category_th || null,
        sub_category,
        sub_category_th || null,
        description,
        description_th || null,
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
        size       = $1,
        color      = $2,
        color_th   = $3,
        pattern    = $4,
        pattern_th = $5,
        chest_min  = $6,
        chest_max  = $7,
        waist_min  = $8,
        waist_max  = $9,
        sleeve     = $10,
        sleeve_th  = $11,
        collar     = $12,
        collar_th  = $13,
        price      = $14,
        cost_price = $15,
        stock      = $16,
        is_active  = $17
      WHERE variant_id = $18
      AND product_id   = $19
      RETURNING variant_id
      `,
      [
        size,
        color,
        color_th || null,
        pattern,
        pattern_th || null,
        chest_min || null,
        chest_max || null,
        waist_min || null,
        waist_max || null,
        sleeve || null,
        sleeve_th || null,
        collar || null,
        collar_th || null,
        price,
        cost_price || null,
        stock,
        is_active !== "false",
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
      UPDATE products
      SET is_active = FALSE, updated_at = NOW()
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
  searchProducts,
  addProduct,
  updateProduct,
  deleteProduct,
}
