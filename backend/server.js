const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

app.post("/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // ✅ 1. เช็คค่าว่าง
    if (!username || !email || !password) {
      return res.status(400).json({ error: "กรอกข้อมูลไม่ครบ" });
    }

    // ✅ 2. hash password
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (username, email, password) VALUES ($1,$2,$3)",
      [username, email, hash]
    );

    res.json({ message: "Register success 🎉" });

  } catch (err) {
    console.error("REGISTER ERROR:", err.message); // ✅ 3. log error ดูง่าย
    res.status(500).json({ error: "Email already exists or server error" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "ไม่พบผู้ใช้นี้" });
    }

    const user = result.rows[0];

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ error: "รหัสผ่านไม่ถูกต้อง" });
    }

    res.json({
      message: "Login success 🎉",
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(5000, () => {
  console.log("✅ Server running on http://localhost:5000");
});
