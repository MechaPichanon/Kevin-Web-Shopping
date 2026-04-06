const fs = require("fs");
const path = require("path");

const pool = require("../db");

function productToText(product) {
  const sizes = Array.isArray(product.sizes) ? product.sizes.join(", ") : "";
  const colors = Array.isArray(product.colors) ? product.colors.join(", ") : "";
  return (
    `Name: ${product.name || ""}\n` +
    `Category: ${product.category || ""}\n` +
    `Price: ${product.price ?? ""} ${product.currency || ""}\n` +
    `Sizes: ${sizes}\n` +
    `Colors: ${colors}\n` +
    `Material: ${product.material || ""}\n` +
    `Description: ${product.description || ""}\n`
  ).trim();
}

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
  try {
    await client.query("BEGIN");

    for (const product of products) {
      if (!product || typeof product !== "object" || !product.id) continue;

      await client.query(
        `
        INSERT INTO products (
          id, name, category, price, currency, sizes, colors, material, description
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          price = EXCLUDED.price,
          currency = EXCLUDED.currency,
          sizes = EXCLUDED.sizes,
          colors = EXCLUDED.colors,
          material = EXCLUDED.material,
          description = EXCLUDED.description,
          updated_at = NOW()
        `,
        [
          String(product.id),
          String(product.name || ""),
          String(product.category || ""),
          Number(product.price ?? 0),
          String(product.currency || ""),
          Array.isArray(product.sizes) ? product.sizes.map(String) : [],
          Array.isArray(product.colors) ? product.colors.map(String) : [],
          String(product.material || ""),
          String(product.description || ""),
        ]
      );

      const content = productToText(product);
      await client.query(
        `
        INSERT INTO product_chunks (product_id, chunk_index, content)
        VALUES ($1, 0, $2)
        ON CONFLICT (product_id, chunk_index) DO UPDATE SET
          content = EXCLUDED.content
        `,
        [String(product.id), content]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

main()
  .then(async () => {
    await pool.end();
    process.stdout.write("Imported products into Postgres.\n");
  })
  .catch(async (err) => {
    try {
      await pool.end();
    } catch {
      // ignore
    }
    process.stderr.write(`${err?.stack || err}\n`);
    process.exit(1);
  });

