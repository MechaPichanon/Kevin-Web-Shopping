const db = require("../db");

// Shared validation + calculation logic, used by both the /discount/validate
// endpoint and createOrder (so a discount is always re-checked server-side
// at order time, never trusted from the client).
// Returns { error } or { discount, discountAmount }.
async function getValidDiscount(code, subtotal, client = db, userId = null) {
  if (!code || !code.trim()) {
    return { error: "กรุณากรอกรหัสส่วนลด" };
  }

  const sub = Number(subtotal) || 0;

  const result = await client.query(
    `SELECT * FROM discount_codes WHERE code = $1`,
    [code.trim().toUpperCase()]
  );

  const discount = result.rows[0];

  if (!discount) {
    return { error: "ไม่พบรหัสส่วนลดนี้" };
  }
  if (!discount.is_active) {
    return { error: "รหัสส่วนลดนี้ถูกปิดใช้งานแล้ว" };
  }

  // A customer may redeem each code once. Cancelled orders do not consume the
  // customer's redemption, matching the existing global used_count rollback.
  if (userId !== null) {
    const previousUse = await client.query(
      `SELECT 1
       FROM orders
       WHERE user_id = $1
         AND UPPER(TRIM(discount_code)) = $2
         AND status <> 'cancelled'
       LIMIT 1`,
      [userId, discount.code]
    );

    if (previousUse.rows.length > 0) {
      return { error: "คุณใช้รหัสส่วนลดนี้ไปแล้ว" };
    }
  }

  const now = new Date();
  if (discount.starts_at && now < new Date(discount.starts_at)) {
    return { error: "รหัสส่วนลดนี้ยังไม่เริ่มใช้งาน" };
  }
  if (discount.expires_at && now > new Date(discount.expires_at)) {
    return { error: "รหัสส่วนลดนี้หมดอายุแล้ว" };
  }
  if (discount.max_uses !== null && discount.used_count >= discount.max_uses) {
    return { error: "รหัสส่วนลดนี้ถูกใช้ครบจำนวนแล้ว" };
  }
  if (sub < Number(discount.min_order)) {
    return {
      error: `ยอดสั่งซื้อขั้นต่ำ ฿${Number(discount.min_order).toLocaleString()} จึงจะใช้รหัสนี้ได้`,
    };
  }

  let discountAmount;
  if (discount.discount_type === "percent") {
    discountAmount = (sub * Number(discount.discount_value)) / 100;
  } else {
    discountAmount = Number(discount.discount_value);
  }
  discountAmount = Math.min(discountAmount, sub);
  discountAmount = Math.round(discountAmount * 100) / 100;

  return { discount, discountAmount };
}

// POST /discount/validate  { code, subtotal }
const validateDiscount = async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    const result = await getValidDiscount(code, subtotal, db, req.user.id);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      code: result.discount.code,
      discount_amount: result.discountAmount,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server Error" });
  }ห
};

module.exports = { validateDiscount, getValidDiscount };
