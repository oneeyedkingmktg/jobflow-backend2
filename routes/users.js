// ============================================================================
// Users Routes - Company-scoped user management (v4.2 - master can query any company)
// FIX: Master admin can pass ?company_id=X to get users for specific company
// ============================================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Convert empty strings → null
const clean = (v) => (v === '' ? null : v);

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// GET /api/users - Get all users in company (Admin/Master only)
// Master admin can optionally pass ?company_id=X to get users for specific company
// ============================================================================

router.get('/', requireRole('admin', 'master'), async (req, res) => {
  try {
    let companyId;

    // Master admin can query any company via query parameter
    if (req.user.role === 'master' && req.query.company_id) {
      companyId = parseInt(req.query.company_id, 10);
    } else {
      // Regular admin or master without query param gets their own company
      companyId = req.user.company_id;
    }

    const result = await db.query(
      `SELECT 
        id,
        company_id,
        email,
        name,
        phone,
        role,
        is_active,
        created_at,
        last_login
       FROM users 
       WHERE company_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [companyId]
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ============================================================================
// POST /api/users - Create new user (Admin/Master only)
// ============================================================================

router.post('/', requireRole('admin', 'master'), async (req, res) => {
  try {
    const { email, password, name, phone, role } = req.body;
    const companyId = req.user.company_id;
    const creatorRole = req.user.role;

    if (!email || !password || !name || !role) {
      return res.status(400).json({
        error: 'Email, password, name, and role are required'
      });
    }

    const roleHierarchy = { master: 3, admin: 2, user: 1 };

    if (
      creatorRole !== 'master' &&
      roleHierarchy[role] >= roleHierarchy[creatorRole]
    ) {
      return res
        .status(403)
        .json({ error: 'Cannot create user with equal or higher role' });
    }

    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (
        company_id,
        email,
        password_hash,
        name,
        phone,
        role
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        company_id,
        email,
        name,
        phone,
        role,
        is_active,
        created_at`,
      [
        companyId,
        email.toLowerCase(),
        passwordHash,
        name,
        clean(phone),
        role
      ]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ============================================================================
// PUT /api/users/:id - Update user (Admin/Master only)
// ============================================================================

router.put('/:id', requireRole('admin', 'master'), async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;
    const { name, phone, role, is_active } = req.body;

    const existing = await db.query(
      'SELECT role FROM users WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await db.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        role = COALESCE($3, role),
        is_active = COALESCE($4, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND company_id = $6
       RETURNING
        id,
        company_id,
        email,
        name,
        phone,
        role,
        is_active,
        updated_at`,
      [
        clean(name),
        clean(phone),
        clean(role),
        is_active,
        id,
        companyId
      ]
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ============================================================================
// DELETE /api/users/:id - Soft delete user (Admin/Master only)
// ============================================================================

router.delete('/:id', requireRole('admin', 'master'), async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    if (parseInt(id, 10) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await db.query(
      `UPDATE users 
       SET deleted_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND company_id = $2
       RETURNING id`,
      [id, companyId]
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

// ============================================================================
// PUT /api/users/me/password - Change own password
// ============================================================================

router.put('/me/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: 'Current and new password required' });
    }

    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];

    const isValid = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!isValid) {
      return res
        .status(401)
        .json({ error: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE users 
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [newPasswordHash, userId]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
