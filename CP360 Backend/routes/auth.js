const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Debug endpoint - remove after testing
router.get('/debug-user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const result = await pool.query(
      `SELECT 
        u.id, 
        u.email, 
        u.password_hash, 
        u.company_id,
        c.company_name,
        u.role, 
        u.is_active,
        c.ghl_location_id 
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.email = $1`,
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.json({ found: false, message: 'User not found' });
    }
    
    const user = result.rows[0];
    res.json({
      found: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.is_active,
        companyId: user.company_id,
        companyName: user.company_name,
        hasPasswordHash: !!user.password_hash,
        hashLength: user.password_hash?.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test password endpoint - remove after testing
router.post('/test-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'User not found' });
    }
    
    const hash = result.rows[0].password_hash;
    const isMatch = await bcrypt.compare(password, hash);
    
    res.json({
      success: true,
      passwordMatches: isMatch,
      hashProvided: !!hash
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await pool.query(
      `SELECT 
        u.id, 
        u.email, 
        u.name,
        u.phone,
        u.password_hash, 
        u.company_id,
        c.company_name,
        c.suspended,
        u.role, 
        c.ghl_location_id 
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (user.suspended === true) {
      return res.status(403).json({ message: 'This account is suspended.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, company_id: user.company_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        companyId: user.company_id,
        companyName: user.company_name,
        role: user.role,
        ghlLocationId: user.ghl_location_id
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// Verify token route
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const result = await pool.query(
      `SELECT 
        u.id, 
        u.email,
        u.name,
        u.phone,
        u.company_id,
        c.company_name,
        u.role, 
        c.ghl_location_id 
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = $1 AND u.is_active = true`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });

  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// ============================================================================
// UPDATE OWN PROFILE (SELF-SERVICE)
// ============================================================================

router.put('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const { name, email, phone, zip, password } = req.body;

    const updates = [];
    const values = [];
    let i = 1;

    if (name) {
      updates.push(`name = $${i++}`);
      values.push(name);
    }
    if (email) {
      updates.push(`email = $${i++}`);
      values.push(email);
    }
    if (phone) {
      updates.push(`phone = $${i++}`);
      values.push(phone);
    }
    if (zip) {
      updates.push(`zip = $${i++}`);
      values.push(zip);
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${i++}`);
      values.push(hash);
    }

    if (updates.length === 0) {
      return res.json({ success: true });
    }

    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i}`,
      [...values, userId]
    );

    res.json({ success: true });

  } catch (error) {
    console.error('Update self error:', error);
    res.status(403).json({ message: 'Insufficient permissions' });
  }
});

// TEST EMAIL - REMOVE AFTER TESTING
router.post('/test-email', async (req, res) => {
  try {
    const { sendPasswordResetEmail } = require('../services/email'); // or '../utils/email'
    
    await sendPasswordResetEmail('troy@proshieldfloors.com', 'TEST-TOKEN-123');
    
    res.json({ success: true, message: 'Test email sent!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// FORGOT PASSWORD - Request reset token
// ============================================================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    // Always return success (don't reveal if email exists)
    if (userResult.rows.length === 0) {
      return res.json({ 
        success: true, 
        message: 'If an account exists, a reset link has been sent.' 
      });
    }

    const user = userResult.rows[0];

    // Generate secure random token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

    // Save token to database
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    // Send email
    const { sendPasswordResetEmail } = require('../services/email');
    await sendPasswordResetEmail(user.email, token);

    res.json({ 
      success: true, 
      message: 'If an account exists, a reset link has been sent.' 
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Unable to process request' });
  }
});

// ============================================================================
// RESET PASSWORD - Validate token and update password
// ============================================================================
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Find valid token
    const tokenResult = await pool.query(
      `SELECT id, user_id, expires_at, used 
       FROM password_reset_tokens 
       WHERE token = $1`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired reset link' });
    }

    const resetToken = tokenResult.rows[0];

    // Check if token is expired
    if (new Date() > new Date(resetToken.expires_at)) {
      return res.status(400).json({ message: 'Reset link has expired' });
    }

    // Check if token was already used
    if (resetToken.used) {
      return res.status(400).json({ message: 'Reset link has already been used' });
    }

    // Hash new password
    const hash = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hash, resetToken.user_id]
    );

    // Mark token as used
    await pool.query(
      'UPDATE password_reset_tokens SET used = true WHERE id = $1',
      [resetToken.id]
    );

    res.json({ 
      success: true, 
      message: 'Password has been reset successfully' 
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Unable to reset password' });
  }
});

module.exports = router;