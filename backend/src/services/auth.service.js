const { pool } = require('../db/pg');
const sqliteDb = require('../db/sqlite');
const { hashPassword, comparePassword } = require('../utils/crypto');
const { generateToken } = require('../utils/jwt');

// Determine role based on email or salesman code
const determineRole = (email, salesmanCode) => {
  if (email) {
    const e = email.toLowerCase();
    if (e.startsWith('edp') || e.startsWith('mgr')) return 'ADMIN';
    if (e.startsWith('spv')) return 'SUPERVISOR';
  }
  if (salesmanCode) {
    const s = salesmanCode.toUpperCase();
    if (['DND', 'DPT', 'FRL', 'LID'].includes(s)) return 'SALESMAN';
  }
  return 'UNKNOWN';
};

const loginUser = async (userid, password) => {
  // 1. Check if user is Salesman (SQLite `users_local` table)
  // We assume userid for salesman is their 3-letter code like 'DND'
  const isSalesmanFormat = /^[A-Z]{3}$/i.test(userid);
  
  if (isSalesmanFormat) {
    const sCode = userid.toUpperCase();
    if (['DND', 'DPT', 'FRL', 'LID'].includes(sCode)) {
      // Check SQLite users_local
      let user = sqliteDb.prepare('SELECT * FROM users_local WHERE userid = ?').get(sCode);
      
      if (!user) {
        // First time salesman login -> Seed default password '123456'
        const defaultHash = await hashPassword('123456');
        sqliteDb.prepare(`
          INSERT INTO users_local (userid, role, password_hash, first_login)
          VALUES (?, ?, ?, 1)
        `).run(sCode, 'SALESMAN', defaultHash);
        
        user = sqliteDb.prepare('SELECT * FROM users_local WHERE userid = ?').get(sCode);
      }
      
      const pwdMatch = await comparePassword(password, user.password_hash);
      if (!pwdMatch) {
        throw new Error('Invalid credentials');
      }
      
      const token = generateToken({
        userid: user.userid,
        role: user.role,
        first_login: user.first_login
      });
      
      return {
        token,
        role: user.role,
        first_login: user.first_login === 1
      };
    }
  }

  // --- HARDOCODED TEST ACCOUNTS OVERRIDE AS REQUESTED ---
  // if (userid === 'FDL' && password === '123456') {
  //   return {
  //     token: generateToken({ userid: 'FDL', role: 'SUPERVISOR', first_login: 0 }),
  //     role: 'SUPERVISOR',
  //     first_login: false
  //   };
  // }

  // 2. Check PG for Admin / Supervisor (tbmaster_user)
  // Assuming fields: userid, username, userpassword, email
  const query = `SELECT userid, username, userpassword, email FROM tbmaster_user WHERE userid = $1`;
  const res = await pool.query(query, [userid]);
  
  if (res.rows.length === 0) {
    throw new Error('Invalid credentials');
  }
  
  const pgUser = res.rows[0];
  
  // Note: Assuming tbmaster_user stores plaintext passwords or simple hashes. 
  // If it's plaintext for legacy ERP, we just compare string.
  // For safety in this prompt, we'll assume plaintext for legacy tbmaster_user or simple comparison.
  if (password !== pgUser.userpassword) {
    throw new Error('Invalid credentials');
  }

  const role = determineRole(pgUser.email, null);
  if (role === 'UNKNOWN') {
    throw new Error('Unauthorized role structure');
  }
  
  const token = generateToken({
    userid: pgUser.userid,
    role: role,
    first_login: 0 // Admins don't have first_login forced reset logic natively
  });
  
  return {
    token,
    role: role,
    first_login: false
  };
};

const changePassword = async (userid, newPassword) => {
  const newHash = await hashPassword(newPassword);
  
  const stmt = sqliteDb.prepare(`
    UPDATE users_local 
    SET password_hash = ?, first_login = 0
    WHERE userid = ?
  `);
  
  const info = stmt.run(newHash, userid.toUpperCase());
  if (info.changes === 0) {
    throw new Error('User not found or role cannot change password locally');
  }
  return true;
};

module.exports = {
  loginUser,
  changePassword,
  determineRole
};
