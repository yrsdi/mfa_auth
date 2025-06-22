const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const otplib = require('otplib');
const qrcode = require('qrcode');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW ? parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 : 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Koneksi ke database MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middleware untuk verifikasi token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token required' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Buat tabel users dengan kolom mfa_secret
async function createTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      mfa_secret VARCHAR(255) DEFAULT NULL
    )
  `;
  await pool.query(query);
}

/**
 * === REGISTER FLOW WITH MFA ===
 * /register/init   => generate mfa secret & QR (tanpa insert ke DB)
 * /register/finish => verifikasi TOTP, insert user+secret ke DB, return token
 */

// 1. INIT REGISTER (generate secret & QR)
app.post('/register/init', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  // Cek user sudah ada
  const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
  if (rows.length > 0) {
    return res.status(409).json({ message: 'User already exists' });
  }
  // Generate MFA secret
  const secret = otplib.authenticator.generateSecret();
  const otpauth = otplib.authenticator.keyuri(username, 'MyApp', secret);
  const qrCode = await qrcode.toDataURL(otpauth);
  return res.json({ secret, qrCode });
});

// 2. FINISH REGISTER (verifikasi TOTP, insert user+secret ke DB, return token)
app.post('/register/finish', async (req, res) => {
  const { username, password, secret, totp } = req.body;
  if (!username || !password || !secret || !totp) {
    return res.status(400).json({ message: 'Incomplete registration data' });
  }
  // Cek user sudah ada
  const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
  if (rows.length > 0) {
    return res.status(409).json({ message: 'User already exists' });
  }
  // Verifikasi TOTP
  const isValid = otplib.authenticator.check(totp, secret);
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid TOTP' });
  }
  // Hash password & insert user ke DB
  const hashedPassword = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO users (username, password, mfa_secret) VALUES (?, ?, ?)',
    [username, hashedPassword, secret]
  );
  // Ambil user baru
  const [userRows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  const user = userRows[0];
  // Buat token JWT
  const token = jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION_TIME || "1h" }
  );
  res.json({ token });
});

// === ENDPOINT LAMA MASIH DIPERTAHANKAN
// Endpoint Registrasi (non-MFA, opsional)
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
    res.status(201).json({ message: 'User registered' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ message: 'Username already exists' });
    } else {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
});

// Endpoint Setup MFA (upgrade user, jika ingin MFA setelah register biasa)
app.post('/mfa/setup', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const secret = otplib.authenticator.generateSecret();
    await pool.query('UPDATE users SET mfa_secret = ? WHERE id = ?', [secret, userId]);
    const otpauth = otplib.authenticator.keyuri(req.user.username, 'MyApp', secret);
    const qrCode = await qrcode.toDataURL(otpauth);
    res.json({ qrCode, secret });
  } catch (error) {
    res.status(500).json({ message: 'Error setting up MFA', error: error.message });
  }
});

// Endpoint Login dengan MFA
app.post('/login', async (req, res) => {
  console.log("BODY:", req.body);

  const { username, password, totp } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'user not found' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (user.mfa_secret) {
      if (!totp) {
        return res.status(401).json({ message: 'TOTP required' });
      }
      const isValid = otplib.authenticator.check(totp, user.mfa_secret);
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid TOTP' });
      }
    }
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION_TIME || "1h" }
    );
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Contoh endpoint yang dilindungi
app.get('/profile', authenticateToken, (req, res) => {
  res.json({ message: 'Welcome', user: req.user });
});

// Mulai server
async function startServer() {
  await createTable();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();