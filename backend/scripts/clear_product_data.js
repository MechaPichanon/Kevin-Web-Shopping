/**
 * clear_product_data.js
 * Wipes the product catalogue and everything that depends on it (variants,
 * images, RAG chunks, image embeddings, reviews, carts, orders, payments) so
 * the admin UI can be used to enter a fresh, real product catalogue.
 *
 * Keeps: users, addresses, discount_codes, store_policies.
 *
 * order_items.variant_id has no ON DELETE rule, so products/variants can't be
 * removed while any order/review/cart still references them — this script
 * clears the whole dependent chain in one TRUNCATE instead.
 *
 * Usage:
 *   node backend/scripts/clear_product_data.js          # dry run, no changes
 *   node backend/scripts/clear_product_data.js --yes    # actually wipes the tables
 */

const pool = require("../db");

const TABLES = [
  "product_image_embeddings",
  "product_chunks",
  "reviews",
  "payments",
  "order_items",
  "orders",
  "cart_items",
  "carts",
  "product_images",
  "variants",
  "products",
];

async function countRows(client) {
  const counts = {};
  for (const table of TABLES) {
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
    counts[table] = rows[0].n;
  }
  return counts;
}

function printCounts(counts) {
  for (const table of TABLES) {
    process.stdout.write(`  ${table.padEnd(28)} ${counts[table]}\n`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const confirmed = process.argv.includes("--yes");
  const client = await pool.connect();

  try {
    const before = await countRows(client);
    const total = Object.values(before).reduce((a, b) => a + b, 0);

    process.stdout.write("Tables and row counts:\n");
    printCounts(before);

    if (total === 0) {
      process.stdout.write("\nAll target tables are already empty. Nothing to do.\n");
      return;
    }

    if (!confirmed) {
      process.stdout.write(
        `\nDry run: ${total} row(s) across ${TABLES.length} table(s) would be permanently deleted.\n` +
          `users, addresses, discount_codes, store_policies are NOT touched.\n` +
          `Re-run with --yes to actually clear the data.\n`
      );
      return;
    }

    await client.query(`TRUNCATE TABLE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);

    const after = await countRows(client);
    process.stdout.write(`\nCleared ${total} row(s). Tables now:\n`);
    printCounts(after);
  } finally {
    client.release();
  }
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (err) => {
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
    process.stderr.write(`${err?.stack || err}\n`);
    process.exit(1);
  });
