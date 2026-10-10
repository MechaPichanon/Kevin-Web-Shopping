// RAG chunk text for products created through the admin page
// (POST /products → product_chunks.content). It must describe every variant and
// include the Thai fields — it used to be built from variants[0] only, in English.
// Creates a throwaway admin + product and deletes both afterwards.
const { test, before, after } = require("node:test")
const assert = require("node:assert/strict")
const express = require("express")
const request = require("supertest")
const jwt = require("jsonwebtoken")

const db = require("../db")
const productRoutes = require("../routes/productRoutes")
const { productToChunkText } = require("../utils/productChunkText")

const app = express()
app.use(express.json())
app.use("/products", productRoutes)

const tag = `t${Date.now()}`
let admin
let productId

const VARIANTS = [
  { size: "M",  color: "Red",   color_th: "แดง",  pattern_th: "เรียบ", sleeve: "short", sleeve_th: "แขนสั้น", price: 200, stock: 5 },
  { size: "L",  color: "Blue",  color_th: "น้ำเงิน", pattern_th: "เรียบ", sleeve: "short", sleeve_th: "แขนสั้น", price: 220, stock: 5 },
  { size: "XL", color: "Green", color_th: "เขียว", pattern_th: "เรียบ", sleeve: "short", sleeve_th: "แขนสั้น", price: 250, stock: 5 },
]

before(async () => {
  const r = await db.query(
    `INSERT INTO users (username, email, password, role) VALUES ($1, $2, 'x', 'admin') RETURNING id`,
    [`${tag}_admin`, `${tag}_admin@test.local`]
  )
  admin = { id: r.rows[0].id }
  admin.token = jwt.sign({ id: admin.id, email: `${tag}_admin@test.local` }, process.env.JWT_SECRET)
})

after(async () => {
  if (productId) {
    await db.query("DELETE FROM product_chunks WHERE product_id = $1", [productId])
    await db.query("DELETE FROM variants WHERE product_id = $1", [productId])
    await db.query("DELETE FROM products WHERE product_id = $1", [productId])
  }
  await db.query("DELETE FROM users WHERE id = $1", [admin.id])
  await db.end()
})

test("admin-created product: chunk text lists all variants and the Thai fields", async () => {
  const res = await request(app)
    .post("/products")
    .set("Authorization", `Bearer ${admin.token}`)
    .field("product_name", `${tag} Test Polo`)
    .field("product_name_th", "โปโลทดสอบ")
    .field("category", "polo")
    .field("category_th", "โปโล")
    .field("sub_category", "test-polo")
    .field("sub_category_th", "โปโลทดสอบ")
    .field("description", "A test polo.")
    .field("description_th", "เสื้อโปโลสำหรับทดสอบ")
    .field("variants", JSON.stringify(VARIANTS))
  assert.equal(res.status, 201, JSON.stringify(res.body))
  productId = res.body.product_id

  const { rows: [chunk] } = await db.query(
    "SELECT content FROM product_chunks WHERE product_id = $1 AND chunk_index = 0", [productId])
  const content = chunk.content

  assert.match(content, /^Colors: Blue, Green, Red$/m)
  assert.match(content, /^Sizes: L, M, XL$/m)
  assert.match(content, /^Price: 200–250 THB$/m)
  assert.match(content, /^ชื่อ: โปโลทดสอบ$/m)
  assert.match(content, /^หมวดหมู่: โปโล$/m)
  assert.match(content, /^สี: น้ำเงิน, เขียว, แดง$/m)
  assert.match(content, /^คำอธิบาย: เสื้อโปโลสำหรับทดสอบ$/m)
})

test("productToChunkText matches retrieval.py _product_to_text formatting", () => {
  // Fixed expectation copied from Python's output for the same input.
  const text = productToChunkText({
    product_name: "X", category: "shirt", description: "",
    variants: [{ size: "M", color: "Red", price: "150.00" }, { size: "L", color: "Red", price: "150.00" }],
  })
  assert.equal(text, "Name: X\nCategory: shirt\nPrice: 150 THB\nSizes: L, M\nColors: Red")
})
