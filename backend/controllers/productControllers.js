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
  p.product_name_th,
  p.category,
  p.sub_category,
  p.description,
  p.description_th,
  pi.image_url,
  json_agg(
    json_build_object(
      'variant_id', pv.variant_id,
      'size',       pv.size,
      'color',      pv.color,
      'color_th',   pv.color_th,
      'pattern',    pv.pattern,
      'pattern_th', pv.pattern_th,
      'chest_min',  pv.chest_min,
      'chest_max',  pv.chest_max,
      'waist_min',  pv.waist_min,
      'waist_max',  pv.waist_max,
      'sleeve',     pv.sleeve,
      'sleeve_th',  pv.sleeve_th,
      'collar',     pv.collar,
      'collar_th',  pv.collar_th,
      'price',      pv.price,
      'cost_price', pv.cost_price,
      'stock',      pv.stock,
      'is_active',  pv.is_active
    ) ORDER BY pv.price ASC
  ) FILTER (WHERE pv.variant_id IS NOT NULL) AS variants

FROM products p

LEFT JOIN variants pv
  ON p.product_id = pv.product_id
  AND pv.is_active = TRUE

LEFT JOIN product_images pi
  ON p.product_id = pi.product_id
  AND pi.is_primary = TRUE

WHERE p.is_active = TRUE

GROUP BY p.product_id, pi.image_url

ORDER BY MAX(p.created_at) DESC
`)

    res.json(result.rows)
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Server error" })
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
    } = req.body

    const variants = JSON.parse(req.body.variants || "[]")
    if (variants.length === 0) {
      return res.status(400).json({ error: "ต้องมีอย่างน้อย 1 variant" })
    }

    let image_url = null
    if (req.file) {
      image_url = `http://localhost:5000/uploads/${req.file.filename}`
    }

    const now = Date.now()
    const productId = "P" + now
    const firstV = variants[0]
    const chunkContent = buildChunkText({
      product_name, category, sub_category, description,
      price: firstV.price, size: firstV.size, color: firstV.color,
      sleeve: firstV.sleeve, collar: firstV.collar,
    })

    client = await db.connect()
    await client.query("BEGIN")

    await client.query(
      `INSERT INTO products
       (product_id, product_name, product_name_th, category, category_th,
        sub_category, sub_category_th, description, description_th)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [productId, product_name, product_name_th || null, category,
       category_th || null, sub_category, sub_category_th || null,
       description, description_th || null]
    )

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]
      const variantId = "V" + now + "_" + i
      await client.query(
        `INSERT INTO variants
         (variant_id, product_id, size, color, color_th, pattern, pattern_th,
          chest_min, chest_max, waist_min, waist_max, sleeve, sleeve_th,
          collar, collar_th, price, cost_price, stock, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [variantId, productId, v.size, v.color, v.color_th || null,
         v.pattern || null, v.pattern_th || null,
         v.chest_min || null, v.chest_max || null,
         v.waist_min || null, v.waist_max || null,
         v.sleeve || null, v.sleeve_th || null,
         v.collar || null, v.collar_th || null,
         v.price, v.cost_price || null, v.stock,
         v.is_active !== false && v.is_active !== "false"]
      )
    }

    if (image_url) {
      const firstVariantId = "V" + now + "_0"
      await client.query(
        `INSERT INTO product_images (product_id, variant_id, image_url, is_primary, sort_order)
         VALUES ($1,$2,$3,true,0)`,
        [productId, firstVariantId, image_url]
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
    res.status(201).json({ message: "เพิ่มสินค้าสำเร็จ" })

    generateAndStoreEmbedding(productId, chunkContent).catch((err) =>
      console.error("[embed] failed for", productId, err.message)
    )
  } catch (err) {
    if (client) await client.query("ROLLBACK")
    console.log(err)
    res.status(500).json({ error: "Server error" })
  } finally {
    if (client) client.release()
  }
}

const updateProduct = async (req, res) => {
  let client

  try {
    const { productId } = req.params
    const {
      product_name, product_name_th,
      category, category_th,
      sub_category, sub_category_th,
      description, description_th,
    } = req.body

    const variants = JSON.parse(req.body.variants || "[]")
    if (variants.length === 0) {
      return res.status(400).json({ error: "ต้องมีอย่างน้อย 1 variant" })
    }

    let image_url = null
    if (req.file) {
      image_url = `http://localhost:5000/uploads/${req.file.filename}`
    }

    const firstV = variants[0]
    const chunkContent = buildChunkText({
      product_name, category, sub_category, description,
      price: firstV.price, size: firstV.size, color: firstV.color,
      sleeve: firstV.sleeve, collar: firstV.collar,
    })

    client = await db.connect()
    await client.query("BEGIN")

    const productResult = await client.query(
      `UPDATE products
       SET product_name=$1, product_name_th=$2, category=$3, category_th=$4,
           sub_category=$5, sub_category_th=$6, description=$7, description_th=$8,
           updated_at=NOW()
       WHERE product_id=$9 RETURNING product_id`,
      [product_name, product_name_th || null, category, category_th || null,
       sub_category, sub_category_th || null, description, description_th || null, productId]
    )

    if (productResult.rowCount === 0) {
      await client.query("ROLLBACK")
      return res.status(404).json({ error: "Product not found" })
    }

    const submittedIds = []
    const now = Date.now()

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]
      const isActive = v.is_active !== false && v.is_active !== "false"

      if (v.variant_id) {
        await client.query(
          `UPDATE variants SET size=$1, color=$2, color_th=$3, pattern=$4, pattern_th=$5,
           chest_min=$6, chest_max=$7, waist_min=$8, waist_max=$9,
           sleeve=$10, sleeve_th=$11, collar=$12, collar_th=$13,
           price=$14, cost_price=$15, stock=$16, is_active=$17
           WHERE variant_id=$18 AND product_id=$19`,
          [v.size, v.color, v.color_th || null, v.pattern || null, v.pattern_th || null,
           v.chest_min || null, v.chest_max || null, v.waist_min || null, v.waist_max || null,
           v.sleeve || null, v.sleeve_th || null, v.collar || null, v.collar_th || null,
           v.price, v.cost_price || null, v.stock, isActive, v.variant_id, productId]
        )
        submittedIds.push(v.variant_id)
      } else {
        const newId = "V" + now + "_" + i
        await client.query(
          `INSERT INTO variants
           (variant_id, product_id, size, color, color_th, pattern, pattern_th,
            chest_min, chest_max, waist_min, waist_max, sleeve, sleeve_th,
            collar, collar_th, price, cost_price, stock, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
          [newId, productId, v.size, v.color, v.color_th || null, v.pattern || null,
           v.pattern_th || null, v.chest_min || null, v.chest_max || null,
           v.waist_min || null, v.waist_max || null, v.sleeve || null, v.sleeve_th || null,
           v.collar || null, v.collar_th || null, v.price, v.cost_price || null,
           v.stock, isActive]
        )
        submittedIds.push(newId)
      }
    }

    // Soft-deactivate variants not in the submitted list
    if (submittedIds.length > 0) {
      await client.query(
        `UPDATE variants SET is_active = FALSE
         WHERE product_id = $1 AND variant_id != ALL($2::text[])`,
        [productId, submittedIds]
      )
    }

    if (image_url) {
      const imageResult = await client.query(
        `UPDATE product_images SET image_url=$1, is_primary=true, sort_order=0
         WHERE product_id=$2 AND is_primary=true RETURNING image_id`,
        [image_url, productId]
      )
      if (imageResult.rowCount === 0) {
        await client.query(
          `INSERT INTO product_images (product_id, variant_id, image_url, is_primary, sort_order)
           VALUES ($1,$2,$3,true,0)`,
          [productId, submittedIds[0], image_url]
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
    res.json({ message: "Product updated successfully" })

    generateAndStoreEmbedding(productId, chunkContent).catch((err) =>
      console.error("[embed] failed for", productId, err.message)
    )
  } catch (err) {
    if (client) await client.query("ROLLBACK")
    console.log(err)
    res.status(500).json({ error: "Server error" })
  } finally {
    if (client) client.release()
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

const getCategories = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT p.category, p.category_th, p.sub_category, p.sub_category_th
      FROM products p
      WHERE p.is_active = TRUE
      ORDER BY p.category, p.sub_category
    `)

    const map = new Map()
    for (const row of result.rows) {
      if (!map.has(row.category)) {
        map.set(row.category, {
          category: row.category,
          category_th: row.category_th || row.category,
          sub_categories: [],
        })
      }
      if (row.sub_category) {
        map.get(row.category).sub_categories.push({
          sub_category: row.sub_category,
          sub_category_th: row.sub_category_th || row.sub_category,
        })
      }
    }

    res.json(Array.from(map.values()))
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Server error" })
  }
}

const filterProducts = async (req, res) => {
  try {
    const { category, sub_category } = req.query
    const cat = !category || category === "all" ? null : category
    const sub = !sub_category || sub_category === "all" ? null : sub_category

    const result = await db.query(
      `
SELECT
  p.product_id,
  p.product_name,
  p.category,
  p.sub_category,
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
  AND ($1::text IS NULL OR p.category = $1)
  AND ($2::text IS NULL OR p.sub_category = $2)

ORDER BY p.created_at DESC
      `,
      [cat, sub]
    )

    res.json(result.rows)
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Server error" })
  }
}

module.exports = {
  getProducts,
  searchProducts,
  getCategories,
  filterProducts,
  addProduct,
  updateProduct,
  deleteProduct,
}
