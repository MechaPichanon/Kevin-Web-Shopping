const db = require("../db");

const getDiscounts = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        code_id,
        code,
        discount_type,
        discount_value,
        min_order,
        max_uses,
        used_count,
        starts_at,
        expires_at,
        is_active
      FROM discount_codes
      ORDER BY code_id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("getDiscounts error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

const createDiscount = async (req, res) => {
  try {
    const {
      code,
      discount_type,
      discount_value,
      min_order,
      max_uses,
      expires_at,
    } = req.body;

    if (!code || !discount_value) {
      return res.status(400).json({
        error: "กรุณากรอกข้อมูลให้ครบ",
      });
    }

    const result = await db.query(
      `INSERT INTO discount_codes
        (code, discount_type, discount_value, min_order, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        code.trim().toUpperCase(),
        discount_type,
        Number(discount_value),
        Number(min_order) || 0,
        max_uses ? Number(max_uses) : null,
        expires_at || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("createDiscount error:", err);

    if (err.code === "23505") {
      return res.status(400).json({
        error: "รหัสส่วนลดนี้มีอยู่แล้ว",
      });
    }

    res.status(500).json({
      error: "Server Error",
    });
  }
};

/* =========================
   TOGGLE ACTIVE / INACTIVE
========================= */

const toggleDiscount = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `
      UPDATE discount_codes
      SET is_active = NOT is_active
      WHERE code_id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "ไม่พบรหัสส่วนลด",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("toggleDiscount error:", err);

    res.status(500).json({
      error: "Server Error",
    });
  }
};

/* =========================
   DELETE DISCOUNT
========================= */

const deleteDiscount = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `
      DELETE FROM discount_codes
      WHERE code_id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "ไม่พบรหัสส่วนลด",
      });
    }

    res.json({
      message: "ลบรหัสส่วนลดเรียบร้อยแล้ว",
      discount: result.rows[0],
    });
  } catch (err) {
    console.error("deleteDiscount error:", err);

    res.status(500).json({
      error: "Server Error",
    });
  }
};

module.exports = {
  getDiscounts,
  createDiscount,
  toggleDiscount,
  deleteDiscount,
};