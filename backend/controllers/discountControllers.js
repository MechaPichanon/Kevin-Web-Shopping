const db = require("../db");

// POST /discount/validate  { code, subtotal }
const validateDiscount = async (req, res) => {
  try {
    const { code, subtotal } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ error: "กรุณากรอกรหัสส่วนลด" });
    }

    const sub = Number(subtotal) || 0;

    const result = await db.query(
      `SELECT * FROM discount_codes WHERE code = $1`,
      [code.trim().toUpperCase()]
    );

    const discount = result.rows[0];

    if (!discount) {
      return res.status(400).json({ error: "ไม่พบรหัสส่วนลดนี้" });
    }

    if (!discount.is_active) {
      return res.status(400).json({ error: "รหัสส่วนลดนี้ถูกปิดใช้งานแล้ว" });
    }

    const now = new Date();
    if (discount.starts_at && now < new Date(discount.starts_at)) {
      return res.status(400).json({ error: "รหัสส่วนลดนี้ยังไม่เริ่มใช้งาน" });
    }
    if (discount.expires_at && now > new Date(discount.expires_at)) {
      return res.status(400).json({ error: "รหัสส่วนลดนี้หมดอายุแล้ว" });
    }

    if (discount.max_uses !== null && discount.used_count >= discount.max_uses) {
      return res.status(400).json({ error: "รหัสส่วนลดนี้ถูกใช้ครบจำนวนแล้ว" });
    }

    if (sub < Number(discount.min_order)) {
      return res.status(400).json({
        error: `ยอดสั่งซื้อขั้นต่ำ ฿${Number(discount.min_order).toLocaleString()} จึงจะใช้รหัสนี้ได้`,
      });
    }

    let discountAmount;
    if (discount.discount_type === "percent") {
      discountAmount = (sub * Number(discount.discount_value)) / 100;
    } else {
      discountAmount = Number(discount.discount_value);
    }

    // Never discount more than the subtotal itself.
    discountAmount = Math.min(discountAmount, sub);

    res.json({
      code: discount.code,
      discount_amount: Math.round(discountAmount * 100) / 100,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server Error" });
  }
};

module.exports = { validateDiscount };