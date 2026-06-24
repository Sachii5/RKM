const { pool } = require('../db/pg');
const db = require('../db/pg_ops');
const { hashPassword, comparePassword } = require('../utils/crypto');
const { generateToken } = require('../utils/jwt');

// Determine role based on email or salesman code
const determineRole = (email, salesmanCode) => {
  if (email) {
    const e = email.toLowerCase();
    if (e.startsWith('edp') || e.startsWith('mgr')) return 'ADMIN';
    if (e.startsWith('spv')) return 'SUPERVISOR';
  }
  return 'UNKNOWN';
};

const loginUser = async (userid, password) => {
  // 1. Check users_local table first (for Salesman or any manually created users)
  const upperUserId = userid.trim().toUpperCase();
  const resUser = await db.query('SELECT * FROM users_local WHERE userid = $1', [upperUserId]);
  
  if (resUser.rows.length > 0) {
    const user = resUser.rows[0];
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
      first_login: user.first_login === true,
      fullname: user.fullname
    };
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
  const res = await pool.query(query, [upperUserId]);
  
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
  
  const res = await db.query(`
    UPDATE users_local 
    SET password_hash = $1, first_login = false
    WHERE userid = $2
  `, [newHash, userid.toUpperCase()]);
  
  if (res.rowCount === 0) {
    throw new Error('User not found or role cannot change password locally');
  }
  return true;
};

module.exports = {
  loginUser,
  changePassword,
  determineRole
};
