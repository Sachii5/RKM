const express = require('express');
const router = express.Router();
const db = require('../db/pg_ops');
const authenticate = require('../middleware/auth.middleware');
const { requireSupervisorOrAbove } = require('../middleware/role.middleware');
const { hashPassword } = require('../utils/crypto');

// Middleware to restrict to SUPERVISOR/ADMIN/MANAGER
// requireSupervisorOrAbove already checks this.
const MANAGEABLE_ROLES = ['ADMIN', 'SUPERVISOR', 'SALESMAN'];

const normalizeRole = (role) => typeof role === 'string' ? role.toUpperCase() : '';

const canManageRole = (actorRole, targetRole) => {
  if (actorRole === 'ADMIN') return MANAGEABLE_ROLES.includes(targetRole);
  if (actorRole === 'SUPERVISOR') return targetRole === 'SALESMAN';
  return false;
};

const getUserById = async (id) => {
  const result = await db.query('SELECT id, userid, fullname, role, first_login FROM users_local WHERE id = $1', [id]);
  return result.rows[0] || null;
};

// GET /api/users
router.get('/', authenticate, requireSupervisorOrAbove, async (req, res) => {
  try {
    const params = [];
    let query = 'SELECT id, userid, fullname, role, first_login FROM users_local';

    if (req.user.role === 'SUPERVISOR') {
      query += ' WHERE role = $1';
      params.push('SALESMAN');
    }

    query += ' ORDER BY userid ASC';

    const resUsers = await db.query(query, params);
    res.json(resUsers.rows);
  } catch (err) {
    console.error('users get error:', err.message);
    res.status(500).json({ error: 'Gagal memuat daftar pengguna' });
  }
});

// POST /api/users
router.post('/', authenticate, requireSupervisorOrAbove, async (req, res) => {
  const { userid, fullname, role } = req.body;
  if (!userid || !role) {
    return res.status(400).json({ error: 'UserID dan Role harus diisi' });
  }

  const targetRole = normalizeRole(role);
  if (!MANAGEABLE_ROLES.includes(targetRole)) {
    return res.status(400).json({ error: 'Role tidak valid' });
  }
  if (!canManageRole(req.user.role, targetRole)) {
    return res.status(403).json({ error: 'Supervisor hanya dapat menambah pengguna SALESMAN' });
  }
  
  try {
    const upperUser = userid.toUpperCase();
    const defaultHash = await hashPassword('123456');
    
    await db.query(`
      INSERT INTO users_local (userid, fullname, role, password_hash, first_login)
      VALUES ($1, $2, $3, $4, true)
    `, [upperUser, fullname || null, targetRole, defaultHash]);
    
    res.json({ success: true, message: 'Salesman berhasil ditambahkan' });
  } catch (err) {
    console.error('users post error:', err.message);
    if (err.code === '23505') { // unique violation
      return res.status(400).json({ error: 'UserID sudah terdaftar' });
    }
    res.status(500).json({ error: 'Gagal menambah pengguna' });
  }
});

// PUT /api/users/:id
router.put('/:id', authenticate, requireSupervisorOrAbove, async (req, res) => {
  const { id } = req.params;
  const { userid, fullname, role } = req.body;
  
  if (!userid || !role) {
    return res.status(400).json({ error: 'UserID dan Role harus diisi' });
  }

  const targetRole = normalizeRole(role);
  if (!MANAGEABLE_ROLES.includes(targetRole)) {
    return res.status(400).json({ error: 'Role tidak valid' });
  }
  
  try {
    const existingUser = await getUserById(id);
    if (!existingUser) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
    if (!canManageRole(req.user.role, existingUser.role) || !canManageRole(req.user.role, targetRole)) {
      return res.status(403).json({ error: 'Supervisor hanya dapat mengedit pengguna SALESMAN' });
    }

    const upperUser = userid.toUpperCase();
    await db.query(`
      UPDATE users_local 
      SET userid = $1, fullname = $2, role = $3
      WHERE id = $4
    `, [upperUser, fullname || null, targetRole, id]);
    
    res.json({ success: true, message: 'Data pengguna berhasil diperbarui' });
  } catch (err) {
    console.error('users put error:', err.message);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'UserID sudah terdaftar' });
    }
    res.status(500).json({ error: 'Gagal memperbarui pengguna' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', authenticate, requireSupervisorOrAbove, async (req, res) => {
  const { id } = req.params;
  try {
    const existingUser = await getUserById(id);
    if (!existingUser) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
    if (!canManageRole(req.user.role, existingUser.role)) {
      return res.status(403).json({ error: 'Supervisor hanya dapat menghapus pengguna SALESMAN' });
    }

    await db.query('DELETE FROM users_local WHERE id = $1', [id]);
    res.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch (err) {
    console.error('users delete error:', err.message);
    res.status(500).json({ error: 'Gagal menghapus pengguna' });
  }
});

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', authenticate, requireSupervisorOrAbove, async (req, res) => {
  const { id } = req.params;
  try {
    const existingUser = await getUserById(id);
    if (!existingUser) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
    if (!canManageRole(req.user.role, existingUser.role)) {
      return res.status(403).json({ error: 'Supervisor hanya dapat mereset password pengguna SALESMAN' });
    }

    const defaultHash = await hashPassword('123456');
    await db.query(`
      UPDATE users_local 
      SET password_hash = $1, first_login = true
      WHERE id = $2
    `, [defaultHash, id]);
    res.json({ success: true, message: 'Password berhasil direset ke 123456' });
  } catch (err) {
    console.error('users reset error:', err.message);
    res.status(500).json({ error: 'Gagal mereset password' });
  }
});

module.exports = router;
