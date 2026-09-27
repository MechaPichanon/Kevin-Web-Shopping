// tests/paymentSlips.test.js — payment_slips is the only store of slip URLs.
// Runs the real /orders routes in-process against the database in
// DATABASE_URL (run inside the auth-backend container: `npm test`).
// The order is inserted directly with no order_items, so no catalogue row
// (variants.stock etc.) is touched. Removes everything it created afterwards,
// including uploaded slip files.
const { test, before, after } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const express = require("express")
const request = require("supertest")
const jwt = require("jsonwebtoken")

const db = require("../db")
const orderRoutes = require("../routes/orderRoutes")
const { handleUploadErrors } = require("../middleware/upload")

const app = express()
app.use(express.json())
app.use("/orders", orderRoutes)
app.use(handleUploadErrors)

const tag = `t${Date.now()}`
const users = {} // name -> { id, token }
const as = (name) => ({ Authorization: `Bearer ${users[name].token}` })
const FIRST_SLIP = `/uploads/${tag}-first.png`
const UPLOADS = path.join(__dirname, "..", "uploads")
let orderId, addressId, filesBefore

before(async () => {
  filesBefore = new Set(fs.readdirSync(UPLOADS))
})

before(async () => {
  for (const [name, role] of [["owner", "customer"], ["other", "customer"], ["admin", "admin"]]) {
    const r = await db.query(
      `INSERT INTO users (username, email, password, role) VALUES ($1, $2, 'x', $3) RETURNING id`,
      [`${tag}_${name}`, `${tag}_${name}@test.local`, role]
    )
    const id = r.rows[0].id
    users[name] = { id, token: jwt.sign({ id, email: `${tag}_${name}@test.local` }, process.env.JWT_SECRET) }
  }

  const a = await db.query(
    `INSERT INTO addresses (recipient_name, phone, address_line1, province, postal_code)
     VALUES ('ทดสอบ สลิป', '0812345678', '1/1 ถนนทดสอบ', 'กรุงเทพมหานคร', '10230')
     RETURNING address_id`
  )
  addressId = a.rows[0].address_id
  await db.query(
    "INSERT INTO user_addresses (user_id, address_id, is_default) VALUES ($1, $2, TRUE)",
    [users.owner.id, addressId]
  )

  const o = await db.query(
    `INSERT INTO orders (user_id, address_id, subtotal, total_price, payment_status)
     VALUES ($1, $2, 100, 100, 'pending_verification') RETURNING order_id`,
    [users.owner.id, addressId]
  )
  orderId = o.rows[0].order_id
  await db.query(
    "INSERT INTO payments (order_id, method, amount) VALUES ($1, 'promptpay', 100)",
    [orderId]
  )
  // The checkout slip, backdated so the re-upload is unambiguously newer.
  await db.query(
    `INSERT INTO payment_slips (order_id, slip_url, uploaded_at)
     VALUES ($1, $2, NOW() - INTERVAL '1 minute')`,
    [orderId, FIRST_SLIP]
  )
})

after(async () => {
  await db.query("DELETE FROM orders WHERE order_id = $1", [orderId]) // cascades slips + payments
  // Remove files this run uploaded — incl. the rejected (403) upload, which
  // multer writes to disk before the controller refuses it. Only files that
  // are new AND referenced by no remaining row are deleted.
  for (const f of fs.readdirSync(UPLOADS)) {
    if (filesBefore.has(f)) continue
    const url = `/uploads/${f}`
    const ref = await db.query(
      `SELECT 1 FROM payment_slips WHERE slip_url = $1
       UNION ALL SELECT 1 FROM product_images WHERE image_url = $1`,
      [url]
    )
    if (ref.rows.length === 0) fs.rmSync(path.join(UPLOADS, f), { force: true })
  }
  await db.query("DELETE FROM user_addresses WHERE address_id = $1", [addressId])
  await db.query("DELETE FROM addresses WHERE address_id = $1", [addressId])
  await db.query("DELETE FROM users WHERE id = ANY($1)", [Object.values(users).map((u) => u.id)])
  await db.end()
})

test("orders.payment_slip_url no longer exists", async () => {
  const r = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = 'orders' AND column_name = 'payment_slip_url'`
  )
  assert.equal(r.rows.length, 0)
})

test("rejected then approved slip: the approved one is the latest everywhere", async () => {
  await request(app).patch(`/orders/admin/${orderId}/payment-status`).set(as("admin"))
    .send({ payment_status: "rejected", reason: "ยอดเงินไม่ตรง" }).expect(200)

  const up = await request(app).post(`/orders/my/${orderId}/payment-slip`).set(as("owner"))
    .attach("slip", Buffer.from("fake-png"), { filename: "slip.png", contentType: "image/png" })
  assert.equal(up.status, 200, JSON.stringify(up.body))

  await request(app).patch(`/orders/admin/${orderId}/payment-status`).set(as("admin"))
    .send({ payment_status: "paid" }).expect(200)

  const views = {
    "GET /orders/my": (await request(app).get("/orders/my").set(as("owner")).expect(200))
      .body.find((o) => o.id === orderId),
    "GET /orders/my/:id": (await request(app).get(`/orders/my/${orderId}`).set(as("owner")).expect(200)).body,
    "GET /orders/admin": (await request(app).get("/orders/admin").set(as("admin")).expect(200))
      .body.find((o) => o.id === orderId),
    "GET /orders/admin/:id": (await request(app).get(`/orders/admin/${orderId}`).set(as("admin")).expect(200)).body,
  }

  for (const [where, order] of Object.entries(views)) {
    assert.ok(order, `${where}: order present`)
    assert.equal(order.paymentStatus, "paid", where)
    // Full history, oldest → newest, still listed.
    assert.deepEqual(order.slips.map((s) => s.status), ["rejected", "approved"], where)
    assert.equal(order.slips[0].url, FIRST_SLIP, where)
    assert.equal(order.slips[0].rejectReason, "ยอดเงินไม่ตรง", where)
    // Latest = the approved re-upload, not the rejected checkout slip.
    assert.equal(order.paymentSlipUrl, order.slips[1].url, where)
    assert.notEqual(order.paymentSlipUrl, FIRST_SLIP, where)
    assert.equal(order.paymentRejectReason, null, `${where}: no stale reason on a paid order`)
  }
})

test("a customer cannot see or add to another customer's slips", async () => {
  await request(app).get(`/orders/my/${orderId}`).set(as("other")).expect(404)

  const list = await request(app).get("/orders/my").set(as("other")).expect(200)
  assert.ok(!list.body.some((o) => o.id === orderId))

  const countBefore = await db.query("SELECT count(*)::int AS n FROM payment_slips WHERE order_id = $1", [orderId])
  const up = await request(app).post(`/orders/my/${orderId}/payment-slip`).set(as("other"))
    .attach("slip", Buffer.from("fake-png"), { filename: "slip.png", contentType: "image/png" })
  assert.equal(up.status, 403)
  const countAfter = await db.query("SELECT count(*)::int AS n FROM payment_slips WHERE order_id = $1", [orderId])
  assert.equal(countAfter.rows[0].n, countBefore.rows[0].n, "no slip row added")

  await request(app).get(`/orders/admin/${orderId}`).set(as("other")).expect(403)
})
