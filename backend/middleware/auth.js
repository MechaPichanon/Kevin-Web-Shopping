const jwt = require("jsonwebtoken");
const pool = require("../db");

async function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "No token" });
  }

  const token = header.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  // JWTs remain valid until they expire, so checking the account here is
  // necessary to immediately revoke access when an admin deactivates a user.
  try {
    const result = await pool.query(
      "SELECT is_active FROM users WHERE id = $1",
      [decoded.id]
    );
    const user = result.rows[0];

    if (!user || user.is_active !== true) {
      return res.status(403).json({
        error: "Account has been deactivated",
        code: "ACCOUNT_DEACTIVATED",
      });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error("AUTH ACCOUNT CHECK ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
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

    req.userRole = user.role;
    next();
  } catch (err) {
    console.error("ADMIN CHECK ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
}

// admin AND staff — used by dashboard KPI reads and by product/order
// management routes that staff are allowed to run. requireAdmin stays
// admin-only (user management, store policy). Sets req.userRole so handlers
// can trim their response for staff without another query.
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

    req.userRole = user.role;
    next();
  } catch (err) {
    console.error("ADMIN OR STAFF CHECK ERROR:", err.message);
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = { auth, requireAdmin, requireAdminOrStaff };
