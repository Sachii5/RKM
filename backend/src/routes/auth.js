const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const authenticate = require('../middleware/auth.middleware');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { userid, password } = req.body;
  if (!userid || !password) {
    return res.status(400).json({ error: 'userid and password are required' });
  }

  try {
    const result = await authService.loginUser(userid, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  // Only Salesman typically uses this local reset based on requirements
  if (req.user.role !== 'SALESMAN') {
    return res.status(403).json({ error: 'Role does not support local password changing' });
  }

  const { newPassword } = req.body;
  
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    await authService.changePassword(req.user.userid, newPassword);
    res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({
    userid: req.user.userid,
    role: req.user.role,
    first_login: req.user.first_login
  });
});

module.exports = router;
