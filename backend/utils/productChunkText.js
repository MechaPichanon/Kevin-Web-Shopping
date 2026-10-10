// The RAG text for a product (product_chunks.content, chunk_index 0) — the text
// that bge-m3 embeds. Must stay identical to _product_to_text() in
// backend/chatbot/retrieval.py: the chatbot falls back to that function when a
// stored embedding is missing, and both must describe a product the same way.
// Aggregates every active variant (all sizes/colours/price range) and includes
// the Thai fields so Thai questions can match.

const uniqSorted = (values) => [...new Set(values.filter(Boolean).map(String))].sort()

function productToChunkText(product) {
  const name     = String(product.product_name || product.name || "")
  const category = product.category ?? ""
  const variants = Array.isArray(product.variants) ? product.variants : []

  if (variants.length === 0) {
    return [
      `Name: ${name}`,
      `Category: ${category}`,
      product.description ? `Description: ${product.description}` : null,
    ].filter(Boolean).join("\n").trim()
  }

  const pick = (key) => uniqSorted(variants.map((v) => v[key]))
  const prices = variants.filter((v) => v.price != null).map((v) => Number(v.price))
  let priceStr = ""
  if (prices.length) {
    const lo = Math.min(...prices)
    const hi = Math.max(...prices)
    priceStr = lo === hi ? `${lo.toFixed(0)} THB` : `${lo.toFixed(0)}–${hi.toFixed(0)} THB`
  }

  const sizes = pick("size"), colors = pick("color"), sleeves = pick("sleeve"), collars = pick("collar")
  const colorsTh = pick("color_th"), patternsTh = pick("pattern_th")
  const sleevesTh = pick("sleeve_th"), collarsTh = pick("collar_th")

  return [
    `Name: ${name}`,
    `Category: ${category}`,
    product.sub_category    ? `Sub-category: ${product.sub_category}` : null,
    priceStr                ? `Price: ${priceStr}`                    : null,
    sizes.length            ? `Sizes: ${sizes.join(", ")}`            : null,
    colors.length           ? `Colors: ${colors.join(", ")}`          : null,
    sleeves.length          ? `Sleeve: ${sleeves.join(", ")}`         : null,
    collars.length          ? `Collar: ${collars.join(", ")}`         : null,
    product.description     ? `Description: ${product.description}`   : null,
    product.product_name_th ? `ชื่อ: ${product.product_name_th}`        : null,
    product.category_th     ? `หมวดหมู่: ${product.category_th}`         : null,
    product.sub_category_th ? `ประเภท: ${product.sub_category_th}`      : null,
    colorsTh.length         ? `สี: ${colorsTh.join(", ")}`              : null,
    patternsTh.length       ? `ลาย: ${patternsTh.join(", ")}`           : null,
    sleevesTh.length        ? `แขน: ${sleevesTh.join(", ")}`            : null,
    collarsTh.length        ? `คอเสื้อ: ${collarsTh.join(", ")}`         : null,
    product.description_th  ? `คำอธิบาย: ${product.description_th}`     : null,
  ].filter(Boolean).join("\n").trim()
}

// Reads the product + its active variants as saved (same columns/filter as
// retrieval.py load_products) and builds the chunk text. Pass the transaction
// client so it sees the rows just written.
async function loadProductChunkText(client, productId) {
  const { rows: [product] } = await client.query(
    `SELECT product_id, product_name, category, sub_category, description,
            product_name_th, description_th, category_th, sub_category_th
     FROM products WHERE product_id = $1`,
    [productId]
  )
  if (!product) return ""
  const { rows: variants } = await client.query(
    `SELECT size, color, color_th, sleeve, collar, price, pattern_th, sleeve_th, collar_th
     FROM variants WHERE product_id = $1 AND is_active = TRUE`,
    [productId]
  )
  return productToChunkText({ ...product, variants })
}

module.exports = { productToChunkText, loadProductChunkText }
