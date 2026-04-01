require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

/* ======================
   JWT Middleware
====================== */
function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "No token" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

/* ======================
   REGISTER
====================== */
app.post("/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "กรอกข้อมูลไม่ครบ" });
    }

    // เช็ค email ซ้ำ
    const check = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (check.rows.length > 0) {
      return res.status(400).json({ error: "Email นี้ถูกใช้แล้ว" });
    }

    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (username, email, password) VALUES ($1,$2,$3)",
      [username, email, hash]
    );

    res.json({ message: "Register success" });

  } catch (err) {
    console.error("REGISTER ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================
   LOGIN
====================== */
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "ไม่พบผู้ใช้" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ error: "รหัสผ่านไม่ถูกต้อง" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login success",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================
   PROFILE (Protected)
====================== */
app.get("/profile", auth, async (req, res) => {
  const userId = req.user.id;

  const result = await pool.query(
    "SELECT id, username, email FROM users WHERE id = $1",
    [userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(result.rows[0]);
});

/* ======================
   START SERVER
====================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});
