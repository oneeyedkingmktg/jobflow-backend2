// ============================================================================
// Users Routes - User management within companies
// ============================================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// GET /api/users - Get all users in company (Admin/Master only)
// ============================================================================
router.get('/', requireRole('admin', 'master'), async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const result = await db.query(
      `SELECT id, email, name, phone, role, is_active, created_at, last_login
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

    // Validation
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Email, password, name, and role are required' });
    }

    // Role validation - users can only create roles at or below their level
    const roleHierarchy = { master: 3, admin: 2, user: 1 };
    
    if (creatorRole !== 'master' && roleHierarchy[role] >= roleHierarchy[creatorRole]) {
      return res.status(403).json({ error: 'Cannot create user with equal or higher role' });
    }

    // Check if email already exists
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await db.query(
      `INSERT INTO users (company_id, email, password_hash, name, phone, role, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, name, phone, role, is_active, created_at`,
      [companyId, email.toLowerCase(), passwordHash, name, phone, role, req.user.id]
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
    const { name, phone, role, is_active } = req.body;
    const companyId = req.user.company_id;

    // Verify user belongs to company
    const existing = await db.query(
      'SELECT role FROM users WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user
    const result = await db.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        role = COALESCE($3, role),
        is_active = COALESCE($4, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND company_id = $6
       RETURNING id, email, name, phone, role, is_active, updated_at`,
      [name, phone, role, is_active, id, companyId]
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ============================================================================
// DELETE /api/users/:id - Delete user (Admin/Master only)
// ============================================================================
router.delete('/:id', requireRole('admin', 'master'), async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    // Cannot delete yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await db.query(
      'UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND company_id = $2 RETURNING id',
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
      return res.status(400).json({ error: 'Current and new password required' });
    }

    // Get current password hash
    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
