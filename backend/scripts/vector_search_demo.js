const pool = require("../db");

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
  return data.embedding;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

  const query = process.argv.slice(2).join(" ").trim() || "cotton shirt";
  const queryVec = await ollamaEmbed(query);

  const { rows } = await pool.query(
    `
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      pc.id AS chunk_id,
      (pc.embedding <=> $1::vector(1024)) AS cosine_distance
    FROM product_chunks pc
    JOIN products p ON p.id = pc.product_id
    WHERE pc.embedding IS NOT NULL
    ORDER BY pc.embedding <=> $1::vector(1024)
    LIMIT 5
    `,
    [toPgvectorLiteral(queryVec)]
  );

  process.stdout.write(`Query: ${query}\n`);
  for (const r of rows) {
    process.stdout.write(
      `- ${r.product_id} | ${r.product_name} | chunk ${r.chunk_id} | dist=${Number(
        r.cosine_distance
      ).toFixed(4)}\n`
    );
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
      // ignore
    }
    process.stderr.write(`${err?.stack || err}\n`);
    process.exit(1);
  });

