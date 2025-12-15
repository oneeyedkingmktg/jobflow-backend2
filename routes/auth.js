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

    console.log('Login attempt for:', email);

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    // Find user by email - JOIN with companies table to get company_name and suspended status
    const result = await pool.query(
      `SELECT 
        u.id, 
        u.email, 
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

    console.log('User found:', result.rows.length > 0);

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    const user = result.rows[0];
    console.log('User ID:', user.id, 'Role:', user.role, 'Company suspended:', user.suspended);

    // Check if company is suspended
    if (user.suspended === true) {
      return res.status(403).json({
        success: false,
        message: 'This account is suspended. Please contact support.'
      });
    }

    // Verify password using password_hash
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('Password valid:', isValidPassword);

    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Generate JWT token - IMPORTANT: Use 'id' not 'userId' to match middleware
    const token = jwt.sign(
      { 
        id: user.id,  // Must be 'id' to match middleware expectations
        email: user.email, 
        role: user.role,
        company_id: user.company_id
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('Login successful for:', email);

    // Return success with token and user info
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        companyId: user.company_id,
        companyName: user.company_name,
        role: user.role,
        ghlLocationId: user.ghl_location_id
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Login failed',
      error: error.message 
    });
  }
});

// Verify token route
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch fresh user data with company info
    const result = await pool.query(
      `SELECT 
        u.id, 
        u.email, 
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
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
});

module.exports = router;
