require("dotenv").config();

// Fail fast and clearly instead of falling through to db.js's DB_HOST
// fallback (which isn't set in docker-compose.yml either) or an empty
// JWT secret — both would otherwise surface as confusing runtime errors
// on the first request rather than a clear message at startup.
for (const name of ["DATABASE_URL", "JWT_SECRET"]) {
  if (!process.env[name]) {
    console.error(`FATAL: ${name} is not set. Check your .env file (see .env.example).`);
    process.exit(1);
  }
}

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const app = express();
const path = require("path")
const { upload, handleUploadErrors } = require("./middleware/upload")
const orderRoutes =
  require("./routes/orderRoutes");
const paymentRoutes = require("./routes/payment");
// Comma-separated, matching CORS_ORIGINS on the chatbot service — a single
// value (the common case) still works unchanged since split() on a string
// with no commas just returns a one-element array.
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

app.use(express.json());

app.use("/cart", cartRoutes);

app.use("/orders", orderRoutes);
app.use("/payment", paymentRoutes);

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Auth backend is running" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "uploads")
  )
)
app.post(
  "/upload/image",
  upload.single("image"),
  (req, res) => {
    res.json({
      imageUrl:
        "http://localhost:5000/uploads/" +
        req.file.filename,
    })
  }
)
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
const { auth, requireAdmin } = require("./middleware/auth");

// Dashboard KPI routes are readable by admin AND staff (the frontend's own
// admin-area guard already allows both) — kept separate from requireAdmin,
// which is admin-only and shared by order/product management routes.
async function requireAdminOrStaff(req, res, next) {
  try {
    const result = await pool.query(
      "SELECT role, is_active FROM users WHERE id = $1",
      [req.user.id]
    );
    const user = result.rows[0];

    if (!user || !["admin", "staff"].includes(user.role) || user.is_active === false) {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (err) {
    console.error("ADMIN OR STAFF CHECK ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
}

// Thailand has no DST, so a plain locale-string round-trip is enough to get
// "today" in Asia/Bangkok regardless of the container's own TZ (UTC).
function getBangkokDateParts() {
  const bkkNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const pad = (n) => String(n).padStart(2, "0");
  const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const today = new Date(bkkNow.getFullYear(), bkkNow.getMonth(), bkkNow.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysIntoMonth = today.getDate(); // e.g. the 19th -> 19 days including today

  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthEnd = new Date(prevMonthStart);
  prevMonthEnd.setDate(prevMonthStart.getDate() + daysIntoMonth - 1);

  return {
    today: toISODate(today),
    yesterday: toISODate(yesterday),
    monthStart: toISODate(monthStart),
    prevMonthStart: toISODate(prevMonthStart),
    prevMonthEnd: toISODate(prevMonthEnd),
  };
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
      `SELECT u.id, u.username, u.email, u.first_name AS "firstName", u.last_name AS "lastName",
              u.phone,
              a.address_line1 AS "addressLine1",
              a.address_line2 AS "addressLine2",
              a.province,
              a.postal_code AS "postalCode"
       FROM users u
       LEFT JOIN user_addresses ua ON ua.user_id = u.id AND ua.is_default = TRUE
       LEFT JOIN addresses a ON a.address_id = ua.address_id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const row = result.rows[0];
    res.json({
      ...row,
      addressLine1: row.addressLine1 || "",
      addressLine2: row.addressLine2 || "",
      province: row.province || "",
      postalCode: row.postalCode || "",
    });
  } catch (err) {
    console.error("PROFILE GET ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/profile", auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const {
      firstName = "",
      lastName = "",
      email = "",
      phone = "",
      addressLine1 = "",
      addressLine2 = "",
      province = "",
      postalCode = "",
    } = req.body;

    if (!email.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }

    await client.query("BEGIN");

    const userResult = await client.query(
      `UPDATE users
       SET email = $1,
           first_name = $2,
           last_name = $3,
           phone = $4
       WHERE id = $5
       RETURNING id, username, email, first_name AS "firstName", last_name AS "lastName",
                 phone`,
      [
        email.trim(),
        firstName.trim(),
        lastName.trim(),
        phone.trim(),
        userId,
      ]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }

    const recipientName = `${firstName.trim()} ${lastName.trim()}`.trim();

    const defaultAddressResult = await client.query(
      `SELECT a.address_id
       FROM user_addresses ua
       JOIN addresses a ON a.address_id = ua.address_id
       WHERE ua.user_id = $1 AND ua.is_default = TRUE`,
      [userId]
    );

    const hasAddressInput = [addressLine1, province, postalCode].some((s) =>
      s.trim()
    );

    let addressRow = {
      addressLine1: "",
      addressLine2: "",
      province: "",
      postalCode: "",
    };

    if (defaultAddressResult.rows.length > 0) {
      const addressId = defaultAddressResult.rows[0].address_id;
      const updated = await client.query(
        `UPDATE addresses
         SET recipient_name = $1,
             phone = $2,
             address_line1 = $3,
             address_line2 = $4,
             province = $5,
             postal_code = $6
         WHERE address_id = $7
         RETURNING address_line1 AS "addressLine1", address_line2 AS "addressLine2", province, postal_code AS "postalCode"`,
        [
          recipientName,
          phone.trim(),
          addressLine1.trim(),
          addressLine2.trim(),
          province.trim(),
          postalCode.trim(),
          addressId,
        ]
      );
      addressRow = updated.rows[0];
    } else if (hasAddressInput) {
      // Only create the user's first address row once they've actually
      // entered something — otherwise every profile save (e.g. just
      // changing a phone number) would leave behind an empty default row.
      const inserted = await client.query(
        `INSERT INTO addresses (
           user_id, recipient_name, phone, address_line1, address_line2, province, postal_code
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING address_id, address_line1 AS "addressLine1", address_line2 AS "addressLine2", province, postal_code AS "postalCode"`,
        [
          userId,
          recipientName,
          phone.trim(),
          addressLine1.trim(),
          addressLine2.trim(),
          province.trim(),
          postalCode.trim(),
        ]
      );
      addressRow = inserted.rows[0];

      await client.query(
        `INSERT INTO user_addresses (user_id, address_id, is_default) VALUES ($1, $2, TRUE)`,
        [userId, addressRow.address_id]
      );
    }

    await client.query("COMMIT");

    res.json({
      message: "Profile updated",
      user: {
        ...userResult.rows[0],
        addressLine1: addressRow.addressLine1 || "",
        addressLine2: addressRow.addressLine2 || "",
        province: addressRow.province || "",
        postalCode: addressRow.postalCode || "",
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PROFILE UPDATE ERROR:", err.message);
    if (err.code === "23505") {
      return res.status(400).json({ error: "Email already in use" });
    }
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
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
      "UPDATE users SET is_active = FALSE WHERE id = $1 RETURNING id",
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

app.get("/admin/stats", auth, requireAdminOrStaff, async (req, res) => {
  try {
    const { today, yesterday, monthStart, prevMonthStart, prevMonthEnd } = getBangkokDateParts();

    const result = await pool.query(
      `
      SELECT
        COALESCE((SELECT SUM(total_price) FROM orders
          WHERE (ordered_at AT TIME ZONE 'Asia/Bangkok')::date = $1::date
            AND status NOT IN ('cancelled','refunded')), 0)::numeric AS sales,
        COALESCE((SELECT SUM(total_price) FROM orders
          WHERE (ordered_at AT TIME ZONE 'Asia/Bangkok')::date = $2::date
            AND status NOT IN ('cancelled','refunded')), 0)::numeric AS sales_yesterday,
        COALESCE((SELECT SUM(total_price) FROM orders
          WHERE (ordered_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $3::date AND $1::date
            AND status NOT IN ('cancelled','refunded')), 0)::numeric AS sales_month,
        COALESCE((SELECT SUM(total_price) FROM orders
          WHERE (ordered_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $4::date AND $5::date
            AND status NOT IN ('cancelled','refunded')), 0)::numeric AS sales_prev_month,
        (SELECT COUNT(*) FROM orders WHERE (ordered_at AT TIME ZONE 'Asia/Bangkok')::date = $1::date)::integer AS orders,
        (SELECT COUNT(*) FROM orders WHERE (ordered_at AT TIME ZONE 'Asia/Bangkok')::date = $2::date)::integer AS orders_yesterday,
        (SELECT COUNT(*) FROM products)::integer AS products,
        (SELECT COUNT(*) FROM products WHERE (created_at AT TIME ZONE 'Asia/Bangkok')::date = $1::date)::integer AS products_new_today,
        (SELECT COUNT(*) FROM users)::integer AS users,
        (SELECT COUNT(*) FROM users WHERE (created_at AT TIME ZONE 'Asia/Bangkok')::date = $1::date)::integer AS users_new_today,
        COALESCE((
          SELECT SUM((oi.unit_price - v.cost_price) * oi.quantity)
          FROM order_items oi
          JOIN orders o ON o.order_id = oi.order_id
          JOIN variants v ON v.variant_id = oi.variant_id
          WHERE (o.ordered_at AT TIME ZONE 'Asia/Bangkok')::date = $1::date
            AND o.status NOT IN ('cancelled','refunded')
            AND v.cost_price IS NOT NULL
        ), 0)::numeric AS profit,
        COALESCE((
          SELECT SUM((oi.unit_price - v.cost_price) * oi.quantity)
          FROM order_items oi
          JOIN orders o ON o.order_id = oi.order_id
          JOIN variants v ON v.variant_id = oi.variant_id
          WHERE (o.ordered_at AT TIME ZONE 'Asia/Bangkok')::date = $2::date
            AND o.status NOT IN ('cancelled','refunded')
            AND v.cost_price IS NOT NULL
        ), 0)::numeric AS profit_yesterday
      `,
      [today, yesterday, monthStart, prevMonthStart, prevMonthEnd]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("ADMIN STATS ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Daily revenue for the last 30 days plus the 30 days before that, so the
// dashboard chart can show a current-vs-previous-period comparison. Gaps
// (days with no orders) are filled with 0 via generate_series rather than
// left absent, so the chart doesn't silently drop points.
app.get("/admin/revenue-daily", auth, requireAdminOrStaff, async (req, res) => {
  try {
    const { today } = getBangkokDateParts();

    const result = await pool.query(
      `
      WITH days AS (
        SELECT generate_series($1::date - INTERVAL '59 days', $1::date, INTERVAL '1 day')::date AS day
      ),
      daily AS (
        SELECT (ordered_at AT TIME ZONE 'Asia/Bangkok')::date AS day, SUM(total_price) AS revenue
        FROM orders
        WHERE status NOT IN ('cancelled','refunded')
          AND (ordered_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1::date - INTERVAL '59 days' AND $1::date
        GROUP BY 1
      )
      SELECT d.day, COALESCE(dl.revenue, 0)::numeric AS revenue
      FROM days d
      LEFT JOIN daily dl ON dl.day = d.day
      ORDER BY d.day
      `,
      [today]
    );

    const format = (r) => ({ date: r.day.toISOString().slice(0, 10), revenue: Number(r.revenue) });
    const rows = result.rows.map(format);

    res.json({ previous: rows.slice(0, 30), current: rows.slice(30, 60) });
  } catch (err) {
    console.error("ADMIN REVENUE DAILY ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/admin/low-stock", auth, requireAdminOrStaff, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.variant_id, v.size, v.color, v.color_th, v.stock,
        p.product_id, p.product_name, p.product_name_th
      FROM variants v
      JOIN products p ON p.product_id = v.product_id
      WHERE v.is_active = TRUE AND p.is_active = TRUE AND v.stock < 5
      ORDER BY v.stock ASC
      LIMIT 10
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("ADMIN LOW STOCK ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/admin/orders/recent", auth, requireAdminOrStaff, async (req, res) => {
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

app.use(handleUploadErrors);

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
