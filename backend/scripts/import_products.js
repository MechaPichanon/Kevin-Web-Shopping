/**
 * import_products.js
 * Upserts products.json into PostgreSQL (new e-commerce schema).
 *
 * Inserts/updates:
 *   products       — product catalogue
 *   variants       — SKU / size / colour / stock / price
 *   product_chunks — RAG text chunks (content only; embeddings via backfill_chunk_embeddings.js)
 *
 * Usage:
 *   node backend/scripts/import_products.js [path/to/products.json]
 */

const fs = require("fs");
const path = require("path");

const pool = require("../db");

// ─────────────────────────────────────────────
// Build the RAG text chunk for a product
// Aggregates variant info so the chatbot can answer about sizes, colours, prices.
// ─────────────────────────────────────────────
function productToChunkText(product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];

  const sizes   = [...new Set(variants.map((v) => v.size).filter(Boolean))].sort();
  const colors  = [...new Set(variants.map((v) => v.color).filter(Boolean))];
  const sleeves = [...new Set(variants.map((v) => v.sleeve).filter(Boolean))];
  const collars = [...new Set(variants.map((v) => v.collar).filter(Boolean))];
  const prices  = variants.map((v) => v.price).filter((p) => p != null && !isNaN(p));

  let priceStr = "";
  if (prices.length) {
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    priceStr = lo === hi ? `${lo} THB` : `${lo}–${hi} THB`;
  }

  const lines = [
    `Name: ${product.product_name || ""}`,
    `Category: ${product.category || ""}`,
    product.sub_category ? `Sub-category: ${product.sub_category}` : null,
    priceStr           ? `Price: ${priceStr}`                    : null,
    sizes.length       ? `Sizes: ${sizes.join(", ")}`           : null,
    colors.length      ? `Colors: ${colors.join(", ")}`         : null,
    sleeves.length     ? `Sleeve: ${sleeves.join(", ")}`        : null,
    collars.length     ? `Collar: ${collars.join(", ")}`        : null,
    product.description ? `Description: ${product.description}` : null,
  ].filter(Boolean);

  return lines.join("\n").trim();
}

// ─────────────────────────────────────────────
async function main() {
  const productsPath =
    process.argv[2] || path.join(__dirname, "..", "data", "products.json");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const raw = fs.readFileSync(productsPath, "utf-8");
  const products = JSON.parse(raw);
  if (!Array.isArray(products)) {
    throw new Error("products.json must be an array");
  }

  const client = await pool.connect();
  let productCount = 0;
  let variantCount = 0;
  let chunkCount   = 0;

  try {
    await client.query("BEGIN");

    for (const product of products) {
      if (!product || typeof product !== "object") continue;

      // ── Resolve product ID (support both old and new format) ──
      const productId = String(product.product_id || product.id || "").trim();
      if (!productId) continue;

      const productName = String(product.product_name || product.name || "").trim();
      const category    = String(product.category || "").trim();
      const subCategory = product.sub_category ? String(product.sub_category) : null;
      const description = product.description  ? String(product.description)  : null;

      // ── Upsert product ──
      await client.query(
        `INSERT INTO products (product_id, product_name, category, sub_category, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (product_id) DO UPDATE SET
           product_name = EXCLUDED.product_name,
           category     = EXCLUDED.category,
           sub_category = EXCLUDED.sub_category,
           description  = EXCLUDED.description,
           updated_at   = NOW()`,
        [productId, productName, category, subCategory, description]
      );
      productCount++;

      // ── Upsert variants ──
      const variants = Array.isArray(product.variants) ? product.variants : [];

      // Legacy format: build a single default variant from top-level fields
      if (variants.length === 0 && (product.price != null || product.sizes || product.colors)) {
        const sizes  = Array.isArray(product.sizes)  ? product.sizes  : [];
        const colors = Array.isArray(product.colors) ? product.colors : [];
        const size   = sizes[0]  || "M";
        const color  = colors[0] || "Default";
        const variantId = `${productId}-DEFAULT`;

        await client.query(
          `INSERT INTO variants (variant_id, product_id, size, color, price, stock)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (variant_id) DO UPDATE SET
             size  = EXCLUDED.size,
             color = EXCLUDED.color,
             price = EXCLUDED.price`,
          [variantId, productId, size, color, Number(product.price ?? 0), 0]
        );
        variantCount++;
      }

      for (const v of variants) {
        if (!v || !v.variant_id) continue;

        await client.query(
          `INSERT INTO variants (
             variant_id, product_id, size, color, pattern,
             chest_min, chest_max, waist_min, waist_max,
             sleeve, collar, price, cost_price, stock, is_active
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
           )
           ON CONFLICT (variant_id) DO UPDATE SET
             size       = EXCLUDED.size,
             color      = EXCLUDED.color,
             pattern    = EXCLUDED.pattern,
             chest_min  = EXCLUDED.chest_min,
             chest_max  = EXCLUDED.chest_max,
             waist_min  = EXCLUDED.waist_min,
             waist_max  = EXCLUDED.waist_max,
             sleeve     = EXCLUDED.sleeve,
             collar     = EXCLUDED.collar,
             price      = EXCLUDED.price,
             cost_price = EXCLUDED.cost_price,
             stock      = EXCLUDED.stock,
             is_active  = EXCLUDED.is_active`,
          [
            String(v.variant_id),
            productId,
            String(v.size   || ""),
            String(v.color  || ""),
            v.pattern   ? String(v.pattern)   : null,
            v.chest_min != null ? Number(v.chest_min) : null,
            v.chest_max != null ? Number(v.chest_max) : null,
            v.waist_min != null ? Number(v.waist_min) : null,
            v.waist_max != null ? Number(v.waist_max) : null,
            v.sleeve    ? String(v.sleeve)    : null,
            v.collar    ? String(v.collar)    : null,
            Number(v.price      ?? 0),
            v.cost_price != null ? Number(v.cost_price) : null,
            Number(v.stock      ?? 0),
            v.is_active === false ? false : true,
          ]
        );
        variantCount++;
      }

      // ── Upsert product_chunk (content for RAG; embedding filled by backfill script) ──
      const content = productToChunkText(product);
      await client.query(
        `INSERT INTO product_chunks (product_id, chunk_index, content)
         VALUES ($1, 0, $2)
         ON CONFLICT (product_id, chunk_index) DO UPDATE SET
           content     = EXCLUDED.content,
           content_hash = '',        -- force embedding refresh on next backfill run
           embedded_at  = NULL`,
        [productId, content]
      );
      chunkCount++;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  process.stdout.write(
    `Imported ${productCount} product(s), ${variantCount} variant(s), ${chunkCount} chunk(s) into PostgreSQL.\n`
  );
  process.stdout.write(
    `Run backfill_chunk_embeddings.js to generate/refresh vector embeddings.\n`
  );
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (err) => {
    try { await pool.end(); } catch { /* ignore */ }
    process.stderr.write(`${err?.stack || err}\n`);
    process.exit(1);
  });
