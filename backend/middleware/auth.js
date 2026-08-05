const jwt = require("jsonwebtoken");
const pool = require("../db");

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

module.exports = { auth, requireAdmin };
