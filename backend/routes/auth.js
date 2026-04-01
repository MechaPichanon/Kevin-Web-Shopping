const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "กรอกข้อมูลไม่ครบ" });
    }

    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users(username, email, password) VALUES($1,$2,$3)",
      [username, email, hash]
    );

    res.json({ message: "สมัครสมาชิกสำเร็จ 🎉" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Email ซ้ำ หรือ server error" });
  }
});

module.exports = router;
