/**
 * regenerate_chunk_text.js
 * Rebuilds product_chunks.content (chunk_index 0) for every product from the
 * current DB rows, using the shared builder in utils/productChunkText.js.
 * Changed rows get content_hash='' / embedded_at=NULL so the next
 * backfill_chunk_embeddings.js run re-embeds them.
 *
 * Unlike import_products.js this never reads products.json, so it is safe on a
 * real catalogue entered through the admin page.
 *
 * Usage:
 *   node backend/scripts/regenerate_chunk_text.js           # dry run
 *   node backend/scripts/regenerate_chunk_text.js --yes     # write
 *   node backend/scripts/backfill_chunk_embeddings.js       # then re-embed
 */
const pool = require("../db");
const { loadProductChunkText } = require("../utils/productChunkText");

async function main() {
  const write = process.argv.includes("--yes");
  const client = await pool.connect();
  let changed = 0;
  try {
    const { rows } = await client.query(
      `SELECT p.product_id, c.content
       FROM products p
       LEFT JOIN product_chunks c ON c.product_id = p.product_id AND c.chunk_index = 0
       ORDER BY p.product_id`
    );
    for (const { product_id, content } of rows) {
      const next = await loadProductChunkText(client, product_id);
      if (next === content) continue;
      changed++;
      console.log(`${write ? "update" : "would update"} ${product_id}`);
      if (write) {
        await client.query(
          `INSERT INTO product_chunks (product_id, chunk_index, content)
           VALUES ($1, 0, $2)
           ON CONFLICT (product_id, chunk_index) DO UPDATE SET
             content      = EXCLUDED.content,
             content_hash = '',
             embedded_at  = NULL`,
          [product_id, next]
        );
      }
    }
    console.log(`${changed} of ${rows.length} products ${write ? "updated" : "would change (dry run, pass --yes)"}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
