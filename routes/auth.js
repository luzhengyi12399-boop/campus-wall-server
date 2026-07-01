const express = require('express');
const db = require('../database');
const { generateToken } = require('../auth');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Register
router.post('/register', (req, res) => {
  const { phone, password, nickName } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ code: 400, message: 'Phone and password required' });
  }
  const existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (existing) {
    return res.status(400).json({ code: 400, message: 'Phone already registered' });
  }
  const id = uuidv4();
  const hashed = bcrypt.hashSync(password, 10);
  const now = Date.now();
  db.prepare('INSERT INTO users (id, phone, password, nickName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, phone, hashed, nickName || '', now, now);
  const token = generateToken(id);
  res.json({ code: 0, data: { token, userId: id } });
});

// Login
router.post('/login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ code: 400, message: 'Phone and password required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ code: 401, message: 'Invalid phone or password' });
  }
  const token = generateToken(user.id);
  res.json({ code: 0, data: { token, userId: user.id } });
});

// WeChat login (mock for now)
router.post('/wx-login', (req, res) => {
  const { code } = req.body;
  // TODO: Implement real WeChat login with wx.getUserInfo
  // For now, create a mock user
  const id = uuidv4();
  const now = Date.now();
  db.prepare('INSERT INTO users (id, openid, nickName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
    .run(id, 'wx_' + code, 'WeChat User', now, now);
  const token = generateToken(id);
  res.json({ code: 0, data: { token, userId: id, isNewUser: true } });
});

module.exports = router;
