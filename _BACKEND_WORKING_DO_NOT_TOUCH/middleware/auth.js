// ============================================================================
// JWT Authentication Middleware
// File: middleware/auth.js
// Version: v3.6 – Dev bypass: master no longer defaults to DEV_COMPANY_ID
// ============================================================================

const jwt = require("jsonwebtoken");
const db = require("../config/database");

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-this-in-production";

// ============================================================================
// Generate JWT
// ============================================================================
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      company_id: user.company_id,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ============================================================================
// Authenticate Token + Load Fresh User
// ============================================================================
const authenticateToken = async (req, res, next) => {
  try {
    // ------------------------------------------------------------
    // DEV MODE: Explicit bypass
    // ------------------------------------------------------------
    const devBypassEnabled =
      String(process.env.DEV_AUTH_BYPASS || "").toLowerCase() === "true";

    if (devBypassEnabled) {
      const requestedCompanyId =
        req.headers["x-company-id"] ||
        req.query.company_id ||
        null; // IMPORTANT: no fallback for master

      req.user = {
        id: "dev-user",
        email: "dev@local.test",
        role: "master",
        company_id: requestedCompanyId
          ? Number(requestedCompanyId)
          : null,
      };

      return next();
    }

    // ------------------------------------------------------------
    // NORMAL JWT FLOW
    // ------------------------------------------------------------
    const header = req.headers["authorization"];
    const token = header && header.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const result = await db.query(
      `SELECT 
         id, email, role, company_id, is_active
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: "User account is inactive" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      company_id: user.company_id,
    };

    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(403).json({ error: "Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(403).json({ error: "Token expired" });
    }
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Authentication error" });
  }
};

// ============================================================================
// Role Authorization
// ============================================================================
const requireRole = (...allowed) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    return next();
  };
};

// ============================================================================
// Company Isolation - Master bypass
// ============================================================================
const requireSameCompany = (req, res, next) => {
  const requestCompanyId =
    req.params.companyId || req.body.company_id || req.query.company_id;

  if (!requestCompanyId) return next();

  if (req.user.role === "master") return next();

  if (parseInt(requestCompanyId) !== req.user.company_id) {
    return res.status(403).json({ error: "Access denied to this company" });
  }

  return next();
};

module.exports = {
  generateToken,
  authenticateToken,
  requireRole,
  requireSameCompany,
};
