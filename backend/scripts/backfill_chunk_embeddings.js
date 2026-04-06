const crypto = require("crypto");

const pool = require("../db");

function sha256(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
}

function toPgvectorLiteral(vec) {
  if (!Array.isArray(vec) || vec.length === 0) return "[]";
  return `[${vec.join(",")}]`;
}

async function ollamaEmbed(text) {
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(
    /\/$/,
    ""
  );
  const model = process.env.OLLAMA_EMBED_MODEL || "bge-m3";

  const res = await fetch(`${baseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: String(text ?? "") }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama embeddings failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  if (!data || !Array.isArray(data.embedding)) {
    throw new Error("Ollama embeddings response missing `embedding` array");
  }
  return { embedding: data.embedding, model };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

  const limit = Number(process.env.BACKFILL_LIMIT || "200");
  const embedModel = process.env.OLLAMA_EMBED_MODEL || "bge-m3";

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `
      SELECT id, content, content_hash, embed_model
      FROM product_chunks
      ORDER BY id
      LIMIT $1
      `,
      [limit]
    );

    let updated = 0;
    for (const row of rows) {
      const content = row.content || "";
      const contentHash = sha256(content);
      const needsUpdate =
        !row.content_hash || row.content_hash !== contentHash || row.embed_model !== embedModel;

      if (!needsUpdate) continue;

      const { embedding, model } = await ollamaEmbed(content);

      await client.query(
        `
        UPDATE product_chunks
        SET
          embedding = $2::vector(1024),
          embed_model = $3,
          embedded_at = NOW(),
          content_hash = $4
        WHERE id = $1
        `,
        [row.id, toPgvectorLiteral(embedding), model, contentHash]
      );
      updated += 1;
    }

    process.stdout.write(`Backfilled embeddings for ${updated} chunk(s).\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (err) => {
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.stderr.write(`${err?.stack || err}\n`);
  process.exit(1);
});

