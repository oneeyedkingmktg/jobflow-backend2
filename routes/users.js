// ============================================================================
// File: routes/users.js
// Version: v4.4 - Support returning ALL users for master admin
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
// GET /api/users - Get users (Admin/Master only)
// Master admin can:
//   - ?company_id=X → Get users for specific company
//   - No query param → Get ALL users from ALL companies
// Regular admin always gets only their own company's users
// ============================================================================

router.get('/', requireRole('admin', 'master'), async (req, res) => {
  try {
    let query;
    let params;

    if (req.user.role === 'master') {
      // Master admin
      if (req.query.company_id) {
        // Specific company requested
        const companyId = parseInt(req.query.company_id, 10);
        query = `SELECT 
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
         ORDER BY created_at DESC`;
        params = [companyId];
      } else {
        // No company_id = return ALL users from ALL companies
        query = `SELECT 
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
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC`;
        params = [];
      }
    } else {
      // Regular admin - only their own company
      query = `SELECT 
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
       ORDER BY created_at DESC`;
      params = [req.user.company_id];
    }

    const result = await db.query(query, params);

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ============================================================================
// POST /api/users - Create new user (Admin/Master only)
// Master admin can specify company_id in request body
// ============================================================================

router.post('/', requireRole('admin', 'master'), async (req, res) => {
  try {
    const { email, password, name, phone, role, company_id } = req.body;
    const creatorRole = req.user.role;

    // Master can specify company_id, otherwise use their own
    let targetCompanyId;
    if (creatorRole === 'master' && company_id) {
      targetCompanyId = company_id;
    } else {
      targetCompanyId = req.user.company_id;
    }

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
        targetCompanyId,
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
// Master admin can update users from any company
// ============================================================================

router.put('/:id', requireRole('admin', 'master'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, is_active, company_id } = req.body;
    const userRole = req.user.role;

    // Get the existing user to check permissions
    const existing = await db.query(
      'SELECT company_id, role FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existingUser = existing.rows[0];

    // Non-master users can only update users in their own company
    if (userRole !== 'master' && existingUser.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Cannot update users from other companies' });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(clean(name));
      paramIndex++;
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      values.push(clean(phone));
      paramIndex++;
    }

    if (role !== undefined) {
      updates.push(`role = $${paramIndex}`);
      values.push(clean(role));
      paramIndex++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(is_active);
      paramIndex++;
    }

    // Master admin can change company assignment
    if (userRole === 'master' && company_id !== undefined) {
      updates.push(`company_id = $${paramIndex}`);
      values.push(company_id);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await db.query(
      `UPDATE users SET
        ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING
        id,
        company_id,
        email,
        name,
        phone,
        role,
        is_active,
        updated_at`,
      values
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ============================================================================
// DELETE /api/users/:id - Soft delete user (Admin/Master only)
// Master admin can delete users from any company
// ============================================================================

router.delete('/:id', requireRole('admin', 'master'), async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;

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
    if (userRole !== 'master' && existing.rows[0].company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Cannot delete users from other companies' });
    }

    const result = await db.query(
      `UPDATE users 
       SET deleted_at = CURRENT_TIMESTAMP 
       WHERE id = $1
       RETURNING id`,
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
