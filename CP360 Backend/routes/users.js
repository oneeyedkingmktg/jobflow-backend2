// ============================================================================
// File: routes/users.js
// Version: v4.6 – Fixed self-update permissions + password routing
// ============================================================================

const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../config/database");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// Convert empty strings → null
const clean = (v) => (v === "" ? null : v);

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// GET /api/users
// Master: all users or by company_id
// Admin: users from own company only
// ============================================================================

router.get("/", requireRole("admin", "master"), async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === "master") {
      if (req.query.company_id) {
        query = `
          SELECT id, company_id, email, name, phone, role, is_active, created_at, last_login
          FROM users
          WHERE company_id = $1 AND deleted_at IS NULL
          ORDER BY created_at DESC
        `;
        params = [req.query.company_id];
      } else {
        query = `
          SELECT id, company_id, email, name, phone, role, is_active, created_at, last_login
          FROM users
          WHERE deleted_at IS NULL
          ORDER BY created_at DESC
        `;
      }
    } else {
      query = `
        SELECT id, company_id, email, name, phone, role, is_active, created_at, last_login
        FROM users
        WHERE company_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
      `;
      params = [req.user.company_id];
    }

    const result = await db.query(query, params);
    res.json({ users: result.rows });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ============================================================================
// POST /api/users – Create user (password allowed here ONLY)
// ============================================================================

router.post("/", requireRole("admin", "master"), async (req, res) => {
  try {
    const { email, password, name, phone, role, company_id } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({
        error: "Email, password, name, and role are required",
      });
    }

    const targetCompanyId =
      req.user.role === "master" && company_id
        ? company_id
        : req.user.company_id;

    const existing = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (existing.rows.length) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `
      INSERT INTO users (company_id, email, password_hash, name, phone, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, company_id, email, name, phone, role, is_active
      `,
      [
        targetCompanyId,
        email.toLowerCase(),
        passwordHash,
        name,
        clean(phone),
        role,
      ]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// ============================================================================
// PUT /api/users/:id – UPDATE PROFILE (NO PASSWORD)
// Users can update themselves, admins can update anyone in company, master can update anyone
// ============================================================================

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);
    const { name, phone, role, is_active, company_id, password } = req.body;

    // 🔴 BLOCK PASSWORD ATTEMPTS HERE
    if (password !== undefined && password !== "") {
      return res.status(400).json({ 
        error: "Password changes must use /users/me/password endpoint" 
      });
    }

    // Get the target user
    const existing = await db.query(
      "SELECT company_id, role FROM users WHERE id = $1 AND deleted_at IS NULL",
      [userId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const targetUser = existing.rows[0];
    const isSelf = userId === req.user.id;

    // ============================================================================
    // PERMISSION CHECKS
    // ============================================================================

    // 1. If updating self → always allowed (but with restrictions)
    if (isSelf) {
      // Users can update their own name/phone, but NOT role or is_active
      if (role !== undefined || is_active !== undefined) {
        return res.status(403).json({ 
          error: "You cannot change your own role or active status" 
        });
      }
    } 
    // 2. If updating someone else → need admin/master
    else {
      // Check if user has admin/master role
      if (req.user.role !== "admin" && req.user.role !== "master") {
        return res.status(403).json({ 
          error: "Insufficient permissions to update other users" 
        });
      }

      // Non-master admins can only update users in their company
      if (
        req.user.role !== "master" &&
        targetUser.company_id !== req.user.company_id
      ) {
        return res.status(403).json({ 
          error: "Cannot update users from other companies" 
        });
      }
    }

    // ============================================================================
    // BUILD UPDATE QUERY
    // ============================================================================

    const updates = [];
    const values = [];
    let i = 1;

    // Name (anyone can update their own, admins can update others)
    if (name !== undefined) {
      updates.push(`name = $${i++}`);
      values.push(clean(name));
    }

    // Phone (anyone can update their own, admins can update others)
    if (phone !== undefined) {
      updates.push(`phone = $${i++}`);
      values.push(clean(phone));
    }

    // Role (only admins/master, and not self)
    if (role !== undefined && !isSelf) {
      updates.push(`role = $${i++}`);
      values.push(role);
    }

    // Active status (only admins/master, and not self)
    if (is_active !== undefined && !isSelf) {
      updates.push(`is_active = $${i++}`);
      values.push(is_active);
    }

    // Company (only master)
    if (req.user.role === "master" && company_id !== undefined && !isSelf) {
      updates.push(`company_id = $${i++}`);
      values.push(company_id);
    }

    if (!updates.length) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(userId);

    const result = await db.query(
      `
      UPDATE users SET ${updates.join(", ")}, updated_at = NOW()
      WHERE id = $${i}
      RETURNING id, company_id, email, name, phone, role, is_active
      `,
      values
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// ============================================================================
// PUT /api/users/me/password – ONLY PLACE PASSWORD CAN CHANGE
// ============================================================================

router.put("/me/password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current and new password required" });
    }

    const result = await db.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [req.user.id]
    );

    const user = result.rows[0];

    const valid = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!valid) {
      return res.status(401).json({ error: "Current password incorrect" });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await db.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [newHash, req.user.id]
    );

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Password change error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// ============================================================================
// DELETE /api/users/:id - Soft delete user (Admin/Master only)
// ============================================================================
router.delete('/:id', requireRole('admin', 'master'), async (req, res) => {
  try {
    const { id } = req.params;

    // Can't delete yourself
    if (parseInt(id, 10) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Get the user to check permissions
    const existing = await db.query(
      'SELECT company_id FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Non-master users can only delete users in their own company
    if (req.user.role !== 'master' && existing.rows[0].company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Cannot delete users from other companies' });
    }

    // Soft delete
    const result = await db.query(
      'UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;