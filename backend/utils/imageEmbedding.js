// Bridges to the Python FastAPI service's embedding models. Node has no
// embedding library of its own, so:
//   - code that inserts a product_images row (or changes its image_url) fires
//     requestImageEmbedding right after (CLIP, stored by FastAPI);
//   - productControllers.js's generateAndStoreEmbedding gets product-text
//     vectors from requestTextEmbedding (bge-m3) — the deployed chatbot has no
//     Ollama for Express to call directly.
// INTERNAL_API_KEY must match the chatbot's (set on both deployed servers;
// unset locally, where neither side checks it).
async function postToChatbot(path, body) {
  const baseUrl = (process.env.FASTAPI_BASE_URL || "http://localhost:8000").replace(/\/$/, "")
  const headers = { "Content-Type": "application/json" }
  if (process.env.INTERNAL_API_KEY) headers["X-Internal-Key"] = process.env.INTERNAL_API_KEY

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`FastAPI ${path} ${res.status}: ${await res.text()}`)
  return res.json()
}

async function requestImageEmbedding(imageId, productId, imageUrl) {
  await postToChatbot("/image-search/embed-one", {
    image_id: imageId,
    product_id: productId,
    image_url: imageUrl,
  })
}

async function requestTextEmbedding(text) {
  const { embedding } = await postToChatbot("/embed-text", { text })
  if (!Array.isArray(embedding)) throw new Error("FastAPI embed-text response missing embedding array")
  return embedding
}

module.exports = { requestImageEmbedding, requestTextEmbedding }
