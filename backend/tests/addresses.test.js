// tests/addresses.test.js — users<->addresses many-to-many via user_addresses.
// Runs the real /addresses routes in-process against the database in
// DATABASE_URL (run inside the auth-backend container: `npm test`).
// Creates throwaway users and removes everything they touched afterwards.
const { test, before, after } = require("node:test")
const assert = require("node:assert/strict")
const express = require("express")
const request = require("supertest")
const jwt = require("jsonwebtoken")

const db = require("../db")
const addressRoutes = require("../routes/addressRoutes")
const { createOrder } = require("../controllers/orderControllers")

const app = express()
app.use(express.json())
app.use("/addresses", addressRoutes)
// createOrder rejects a request with no slip before it ever looks at the
// address, so fake an attached slip — otherwise the address test below would
// get its 400 from the missing file, not from the address check. The request
// is rejected before anything is written, so no file or row is created.
app.post("/orders/create", (req, res, next) => {
  req.file = { filename: "test-slip.png" }
  next()
}, createOrder)

const tag = `t${Date.now()}`
const users = {} // name -> { id, token }

const ADDRESS = {
  recipientName: "ทดสอบ ระบบ",
  phone: "0812345678",
  addressLine1: "1/1 ถนนทดสอบ",
  addressLine2: "",
  subDistrict: "ลาดพร้าว",
  district: "ลาดพร้าว",
  province: "กรุงเทพมหานคร",
  postalCode: "10230",
}

const as = (name) => ({ Authorization: `Bearer ${users[name].token}` })

async function createAddress(name, body = {}) {
  const res = await request(app).post("/addresses").set(as(name)).send({ ...ADDRESS, ...body })
  assert.equal(res.status, 201, JSON.stringify(res.body))
  return res.body.id
}

async function listIds(name) {
  const res = await request(app).get("/addresses").set(as(name))
  assert.equal(res.status, 200)
  return res.body
}

async function addressExists(id) {
  const r = await db.query("SELECT 1 FROM addresses WHERE address_id = $1", [id])
  return r.rows.length === 1
}

before(async () => {
  for (const name of ["a", "b", "c", "d"]) {
    const r = await db.query(
      `INSERT INTO users (username, email, password) VALUES ($1, $2, 'x') RETURNING id`,
      [`${tag}_${name}`, `${tag}_${name}@test.local`]
    )
    const id = r.rows[0].id
    users[name] = { id, token: jwt.sign({ id, email: `${tag}_${name}@test.local` }, process.env.JWT_SECRET) }
  }
})

after(async () => {
  const ids = Object.values(users).map((u) => u.id)
  const linked = await db.query(
    "SELECT DISTINCT address_id FROM user_addresses WHERE user_id = ANY($1)", [ids])
  await db.query("DELETE FROM user_addresses WHERE user_id = ANY($1)", [ids])
  await db.query(
    `DELETE FROM addresses a WHERE a.address_id = ANY($1)
       AND NOT EXISTS (SELECT 1 FROM user_addresses ua WHERE ua.address_id = a.address_id)
       AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.address_id = a.address_id)`,
    [linked.rows.map((r) => r.address_id)]
  )
  await db.query("DELETE FROM users WHERE id = ANY($1)", [ids])
  await db.end()
})

test("legacy ownership columns are gone", async () => {
  const r = await db.query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE (table_name = 'addresses' AND column_name = 'user_id')
        OR (table_name = 'users' AND column_name = 'address')`
  )
  assert.deepEqual(r.rows, [])
})

test("a shared address is visible to both users", async () => {
  const id = await createAddress("a")
  // Sharing = one more user_addresses row, nothing else.
  await db.query("INSERT INTO user_addresses (user_id, address_id) VALUES ($1, $2)", [users.b.id, id])

  assert.ok((await listIds("a")).some((x) => x.id === id))
  assert.ok((await listIds("b")).some((x) => x.id === id))
})

test("each user has at most one default address", async () => {
  const first = await createAddress("d")
  const second = await createAddress("d")

  let list = await listIds("d")
  assert.equal(list.filter((x) => x.isDefault).length, 1)
  assert.equal(list.find((x) => x.isDefault).id, first, "first address becomes the default")

  const res = await request(app).patch(`/addresses/${second}/default`).set(as("d"))
  assert.equal(res.status, 200)
  list = await listIds("d")
  assert.deepEqual(list.filter((x) => x.isDefault).map((x) => x.id), [second])

  // The partial unique index rejects a second default even outside the API.
  await assert.rejects(
    db.query("UPDATE user_addresses SET is_default = TRUE WHERE user_id = $1 AND address_id = $2",
      [users.d.id, first]),
    (err) => err.code === "23505"
  )
})

test("unlinking a shared address keeps it for the other user", async () => {
  const id = await createAddress("a")
  await db.query("INSERT INTO user_addresses (user_id, address_id) VALUES ($1, $2)", [users.b.id, id])

  const res = await request(app).delete(`/addresses/${id}`).set(as("b"))
  assert.equal(res.status, 200)
  assert.ok(!(await listIds("b")).some((x) => x.id === id), "gone from b's list")
  assert.ok((await listIds("a")).some((x) => x.id === id), "still in a's list")
  assert.ok(await addressExists(id), "addresses row kept")

  // Last link removed and no order references it -> row is deleted.
  await request(app).delete(`/addresses/${id}`).set(as("a")).expect(200)
  assert.ok(!(await addressExists(id)), "addresses row deleted once unlinked by everyone")
})

test("a user cannot access an address they are not linked to", async () => {
  const id = await createAddress("a")

  assert.ok(!(await listIds("c")).some((x) => x.id === id))
  await request(app).put(`/addresses/${id}`).set(as("c")).send(ADDRESS).expect(404)
  await request(app).patch(`/addresses/${id}/default`).set(as("c")).expect(404)
  await request(app).delete(`/addresses/${id}`).set(as("c")).expect(404)
  assert.ok(await addressExists(id), "untouched after c's attempts")

  const order = await request(app).post("/orders/create")
    .send({ user_id: users.c.id, address_id: id, payment_method: "promptpay" })
  assert.equal(order.status, 400, "checkout rejects an address the buyer isn't linked to")
  assert.equal(order.body.error, "กรุณาเลือกที่อยู่จัดส่ง", "rejected by the address check, not an earlier one")
})
