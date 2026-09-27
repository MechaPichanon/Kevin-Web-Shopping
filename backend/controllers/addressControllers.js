// controllers/addressControllers.js
// Multi-address book — shared by the profile "สมุดที่อยู่" page and the
// checkout address chips. user_addresses is the only link between users and
// addresses (many-to-many, see 011_/024_): every ownership check goes through it.
const db = require("../db")

const ADDRESS_COLUMNS = `
  a.address_id     AS "id",
  a.recipient_name AS "recipientName",
  a.phone,
  a.address_line1  AS "addressLine1",
  a.address_line2  AS "addressLine2",
  a.sub_district   AS "subDistrict",
  a.district,
  a.province,
  a.postal_code    AS "postalCode",
  ua.is_default    AS "isDefault"`

// Phone is stored as digits only; the UI adds dashes for display.
function readAddressBody(body = {}) {
  const str = (v) => (typeof v === "string" ? v.trim() : "")
  return {
    recipientName: str(body.recipientName),
    phone: str(body.phone).replace(/\D/g, ""),
    addressLine1: str(body.addressLine1),
    addressLine2: str(body.addressLine2),
    subDistrict: str(body.subDistrict),
    district: str(body.district),
    province: str(body.province),
    postalCode: str(body.postalCode),
    isDefault: body.isDefault === true,
  }
}

function validateAddress(a) {
  if (!a.recipientName) return "กรุณากรอกชื่อผู้รับ"
  if (a.phone.length < 9 || a.phone.length > 10) return "เบอร์โทรไม่ถูกต้อง"
  if (!a.addressLine1) return "กรุณากรอกที่อยู่"
  if (!a.province) return "กรุณาเลือกจังหวัด"
  if (!a.district) return "กรุณากรอกเขต/อำเภอ"
  if (!a.subDistrict) return "กรุณากรอกแขวง/ตำบล"
  if (!/^\d{5}$/.test(a.postalCode)) return "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก"
  return null
}

// Clear first, then set — the partial unique index (022_) allows at most one
// default per user, so the two can't be swapped in a single UPDATE.
async function setDefaultAddress(client, userId, addressId) {
  await client.query(
    `UPDATE user_addresses SET is_default = FALSE
     WHERE user_id = $1 AND is_default AND address_id <> $2`,
    [userId, addressId]
  )
  await client.query(
    `UPDATE user_addresses SET is_default = TRUE
     WHERE user_id = $1 AND address_id = $2`,
    [userId, addressId]
  )
}

async function findOwnedAddress(client, userId, addressId) {
  const result = await client.query(
    `SELECT ${ADDRESS_COLUMNS}
     FROM user_addresses ua
     JOIN addresses a ON a.address_id = ua.address_id
     WHERE ua.user_id = $1 AND ua.address_id = $2`,
    [userId, addressId]
  )
  return result.rows[0] || null
}

function parseId(raw) {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

// GET /addresses
const listMyAddresses = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ${ADDRESS_COLUMNS}
       FROM user_addresses ua
       JOIN addresses a ON a.address_id = ua.address_id
       WHERE ua.user_id = $1
       ORDER BY ua.is_default DESC, ua.added_at, a.address_id`,
      [req.user.id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error("LIST ADDRESSES ERROR:", err.message)
    res.status(500).json({ error: "Server error" })
  }
}

// POST /addresses
const createAddress = async (req, res) => {
  const userId = req.user.id
  const a = readAddressBody(req.body)
  const invalid = validateAddress(a)
  if (invalid) return res.status(400).json({ error: invalid })

  const client = await db.connect()
  try {
    await client.query("BEGIN")

    const inserted = await client.query(
      `INSERT INTO addresses (
         recipient_name, phone, address_line1, address_line2,
         sub_district, district, province, postal_code
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING address_id`,
      [a.recipientName, a.phone, a.addressLine1, a.addressLine2,
       a.subDistrict, a.district, a.province, a.postalCode]
    )
    const addressId = inserted.rows[0].address_id

    await client.query(
      `INSERT INTO user_addresses (user_id, address_id, is_default) VALUES ($1, $2, FALSE)`,
      [userId, addressId]
    )

    // The user's first address is always the default.
    const hasDefault = await client.query(
      `SELECT 1 FROM user_addresses WHERE user_id = $1 AND is_default`,
      [userId]
    )
    if (a.isDefault || hasDefault.rows.length === 0) {
      await setDefaultAddress(client, userId, addressId)
    }

    const address = await findOwnedAddress(client, userId, addressId)
    await client.query("COMMIT")
    res.status(201).json(address)
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("CREATE ADDRESS ERROR:", err.message)
    res.status(500).json({ error: "Server error" })
  } finally {
    client.release()
  }
}

// PUT /addresses/:id — isDefault:false is ignored on purpose: a default is
// only moved (set another / delete this one), never cleared, so a user with
// addresses always has exactly one default.
const updateAddress = async (req, res) => {
  const userId = req.user.id
  const addressId = parseId(req.params.id)
  if (!addressId) return res.status(404).json({ error: "ไม่พบที่อยู่" })

  const a = readAddressBody(req.body)
  const invalid = validateAddress(a)
  if (invalid) return res.status(400).json({ error: invalid })

  const client = await db.connect()
  try {
    await client.query("BEGIN")

    if (!(await findOwnedAddress(client, userId, addressId))) {
      await client.query("ROLLBACK")
      return res.status(404).json({ error: "ไม่พบที่อยู่" })
    }

    await client.query(
      `UPDATE addresses
       SET recipient_name = $1, phone = $2, address_line1 = $3, address_line2 = $4,
           sub_district = $5, district = $6, province = $7, postal_code = $8
       WHERE address_id = $9`,
      [a.recipientName, a.phone, a.addressLine1, a.addressLine2,
       a.subDistrict, a.district, a.province, a.postalCode, addressId]
    )

    if (a.isDefault) {
      await setDefaultAddress(client, userId, addressId)
    }

    const address = await findOwnedAddress(client, userId, addressId)
    await client.query("COMMIT")
    res.json(address)
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("UPDATE ADDRESS ERROR:", err.message)
    res.status(500).json({ error: "Server error" })
  } finally {
    client.release()
  }
}

// PATCH /addresses/:id/default
const makeDefaultAddress = async (req, res) => {
  const userId = req.user.id
  const addressId = parseId(req.params.id)
  if (!addressId) return res.status(404).json({ error: "ไม่พบที่อยู่" })

  const client = await db.connect()
  try {
    await client.query("BEGIN")
    if (!(await findOwnedAddress(client, userId, addressId))) {
      await client.query("ROLLBACK")
      return res.status(404).json({ error: "ไม่พบที่อยู่" })
    }
    await setDefaultAddress(client, userId, addressId)
    await client.query("COMMIT")
    res.json({ message: "Default address updated" })
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("SET DEFAULT ADDRESS ERROR:", err.message)
    res.status(500).json({ error: "Server error" })
  } finally {
    client.release()
  }
}

// DELETE /addresses/:id — unlinks the address from this user. The addresses
// row itself is only removed when nothing else points at it: orders.address_id
// has no ON DELETE rule (past orders keep their link + shipping_snapshot), and
// another account may share it via user_addresses.
const deleteAddress = async (req, res) => {
  const userId = req.user.id
  const addressId = parseId(req.params.id)
  if (!addressId) return res.status(404).json({ error: "ไม่พบที่อยู่" })

  const client = await db.connect()
  try {
    await client.query("BEGIN")

    const owned = await findOwnedAddress(client, userId, addressId)
    if (!owned) {
      await client.query("ROLLBACK")
      return res.status(404).json({ error: "ไม่พบที่อยู่" })
    }

    await client.query(
      `DELETE FROM user_addresses WHERE user_id = $1 AND address_id = $2`,
      [userId, addressId]
    )

    await client.query(
      `DELETE FROM addresses a
       WHERE a.address_id = $1
         AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.address_id = a.address_id)
         AND NOT EXISTS (SELECT 1 FROM user_addresses ua WHERE ua.address_id = a.address_id)`,
      [addressId]
    )

    if (owned.isDefault) {
      const next = await client.query(
        `SELECT address_id FROM user_addresses
         WHERE user_id = $1
         ORDER BY added_at, address_id
         LIMIT 1`,
        [userId]
      )
      if (next.rows.length > 0) {
        await setDefaultAddress(client, userId, next.rows[0].address_id)
      }
    }

    await client.query("COMMIT")
    res.json({ message: "Address removed" })
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("DELETE ADDRESS ERROR:", err.message)
    res.status(500).json({ error: "Server error" })
  } finally {
    client.release()
  }
}

module.exports = {
  listMyAddresses,
  createAddress,
  updateAddress,
  makeDefaultAddress,
  deleteAddress,
}
