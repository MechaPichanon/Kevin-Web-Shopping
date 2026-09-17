// Fire-and-forget bridge to the Python FastAPI service's CLIP model.
// Node has no image-embedding library of its own, so any code that inserts
// a product_images row (or changes its image_url) calls this right after,
// the same way productControllers.js already fires generateAndStoreEmbedding
// for product text.
async function requestImageEmbedding(imageId, productId, imageUrl) {
  const baseUrl = (process.env.FASTAPI_BASE_URL || "http://localhost:8000").replace(/\/$/, "")

  const res = await fetch(`${baseUrl}/image-search/embed-one`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_id: imageId, product_id: productId, image_url: imageUrl }),
  })
  if (!res.ok) throw new Error(`FastAPI embed-one ${res.status}: ${await res.text()}`)
}

module.exports = { requestImageEmbedding }
