require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const productRoutes = require("./routes/productRoutes");
const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

async function ensureUserProfileColumns() {
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
  `);
}


app.use("/products", productRoutes)
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

async function requireAdmin(req, res, next) {
  try {
    const result = await pool.query(
      "SELECT role, is_active FROM users WHERE id = $1",
      [req.user.id]
    );

    const user = result.rows[0];

    if (!user || user.role !== "admin" || user.is_active === false) {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (err) {
    console.error("ADMIN CHECK ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
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
        role: user.role,
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
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, username, email, first_name AS "firstName", last_name AS "lastName",
              phone, address
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PROFILE GET ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/profile", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      firstName = "",
      lastName = "",
      email = "",
      phone = "",
      address = "",
    } = req.body;

    if (!email.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }

    const result = await pool.query(
      `UPDATE users
       SET email = $1,
           first_name = $2,
           last_name = $3,
           phone = $4,
           address = $5
       WHERE id = $6
       RETURNING id, username, email, first_name AS "firstName", last_name AS "lastName",
                 phone, address`,
      [
        email.trim(),
        firstName.trim(),
        lastName.trim(),
        phone.trim(),
        address.trim(),
        userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "Profile updated",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("PROFILE UPDATE ERROR:", err.message);
    if (err.code === "23505") {
      return res.status(400).json({ error: "Email already in use" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/users", auth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, email, first_name, last_name, phone, role, is_active, created_at
      FROM users
      ORDER BY id
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("USERS LIST ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/users/:id", auth, requireAdmin, async (req, res) => {
  try {
    const { username, email, first_name, last_name, phone, role, is_active } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET username = $1,
           email = $2,
           first_name = $3,
           last_name = $4,
           phone = $5,
           role = $6,
           is_active = $7
       WHERE id = $8
       RETURNING id, username, email, first_name, last_name, phone, role, is_active, created_at`,
      [username, email, first_name, last_name, phone, role, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("USER UPDATE ERROR:", err.message);
    if (err.code === "23505") {
      return res.status(400).json({ error: "Username or email already exists" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/users/:id", auth, requireAdmin, async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("USER DELETE ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/admin/stats", auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE((SELECT SUM(total_price) FROM orders WHERE ordered_at::date = CURRENT_DATE), 0)::numeric AS sales,
        (SELECT COUNT(*) FROM orders WHERE ordered_at::date = CURRENT_DATE)::integer AS orders,
        (SELECT COUNT(*) FROM products)::integer AS products,
        (SELECT COUNT(*) FROM users)::integer AS users
    `);

    res.json(result.rows[0]);
  } catch (err) {
    console.error("ADMIN STATS ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/admin/orders/recent", auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        o.order_id AS id,
        COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.username) AS customer,
        o.total_price AS total,
        o.status,
        o.ordered_at::date AS date
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ORDER BY o.ordered_at DESC
      LIMIT 10
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("ADMIN RECENT ORDERS ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================
   START SERVER
====================== */
const PORT = process.env.PORT || 5000;
ensureUserProfileColumns()
  .then(() => {
    app.listen(PORT, () => {
      console.log(` Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("SCHEMA INIT ERROR:", err.message);
    process.exit(1);
  });
