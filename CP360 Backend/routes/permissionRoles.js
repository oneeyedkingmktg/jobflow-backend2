// ============================================================================
// File: routes/permissionRoles.js
// CRUD for company-defined permission role presets
// ============================================================================

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authenticateToken, requireRole } = require("../middleware/auth");

router.use(authenticateToken);

// Resolve company_id for the request (master can pass ?company_id=)
function resolveCompanyId(req) {
  if (req.user.role === "master" && req.query.company_id) {
    return parseInt(req.query.company_id, 10);
  }
  if (req.user.role === "master" && req.body && req.body.company_id) {
    return parseInt(req.body.company_id, 10);
  }
  return req.user.company_id;
}

// ============================================================================
// GET /api/permission-roles — list all roles for the company
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const result = await db.query(
      `SELECT id, company_id, name, is_custom, permissions, created_at
       FROM permission_roles
       WHERE company_id = $1
       ORDER BY created_at ASC`,
      [companyId]
    );

    res.json({ roles: result.rows });
  } catch (err) {
    console.error("Get permission roles error:", err);
    res.status(500).json({ error: "Failed to fetch permission roles" });
  }
});

// ============================================================================
// POST /api/permission-roles — create a new role
// ============================================================================
router.post("/", requireRole("admin", "master"), async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "company_id required" });

    const { name, is_custom = false, permissions = {} } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Role name is required" });
    }

    const result = await db.query(
      `INSERT INTO permission_roles (company_id, name, is_custom, permissions)
       VALUES ($1, $2, $3, $4)
       RETURNING id, company_id, name, is_custom, permissions, created_at`,
      [companyId, name.trim(), is_custom, permissions]
    );

    res.status(201).json({ role: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "A role with that name already exists" });
    }
    console.error("Create permission role error:", err);
    res.status(500).json({ error: "Failed to create permission role" });
  }
});

// ============================================================================
// PUT /api/permission-roles/:id — update name and/or permissions
// ============================================================================
router.put("/:id", requireRole("admin", "master"), async (req, res) => {
  try {
    const roleId = parseInt(req.params.id, 10);
    const companyId = resolveCompanyId(req);

    // Confirm role belongs to this company
    const existing = await db.query(
      "SELECT company_id FROM permission_roles WHERE id = $1",
      [roleId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: "Role not found" });
    }
    if (req.user.role !== "master" && existing.rows[0].company_id !== companyId) {
      return res.status(403).json({ error: "Cannot update roles from other companies" });
    }

    const { name, is_custom, permissions } = req.body;

    const updates = [];
    const values = [];
    let i = 1;

    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name.trim()); }
    if (is_custom !== undefined) { updates.push(`is_custom = $${i++}`); values.push(is_custom); }
    if (permissions !== undefined) { updates.push(`permissions = $${i++}`); values.push(permissions); }

    if (!updates.length) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(roleId);
    const result = await db.query(
      `UPDATE permission_roles SET ${updates.join(", ")} WHERE id = $${i}
       RETURNING id, company_id, name, is_custom, permissions, created_at`,
      values
    );

    res.json({ role: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "A role with that name already exists" });
    }
    console.error("Update permission role error:", err);
    res.status(500).json({ error: "Failed to update permission role" });
  }
});

// ============================================================================
// DELETE /api/permission-roles/:id — delete role (blocked if users assigned)
// ============================================================================
router.delete("/:id", requireRole("admin", "master"), async (req, res) => {
  try {
    const roleId = parseInt(req.params.id, 10);
    const companyId = resolveCompanyId(req);

    const existing = await db.query(
      "SELECT company_id FROM permission_roles WHERE id = $1",
      [roleId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: "Role not found" });
    }
    if (req.user.role !== "master" && existing.rows[0].company_id !== companyId) {
      return res.status(403).json({ error: "Cannot delete roles from other companies" });
    }

    // Block delete if any users are assigned to this role
    const assigned = await db.query(
      "SELECT COUNT(*) FROM users WHERE permission_role_id = $1 AND deleted_at IS NULL",
      [roleId]
    );
    if (parseInt(assigned.rows[0].count, 10) > 0) {
      return res.status(400).json({
        error: "Cannot delete a role that is assigned to users. Reassign those users first.",
      });
    }

    await db.query("DELETE FROM permission_roles WHERE id = $1", [roleId]);
    res.json({ message: "Role deleted successfully" });
  } catch (err) {
    console.error("Delete permission role error:", err);
    res.status(500).json({ error: "Failed to delete permission role" });
  }
});

module.exports = router;
