const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { generateToken } = require('../auth');

const router = express.Router();

// Register
router.post('/register', (req, res) => {
  const { nickName, phone, password } = req.body;
  if (!nickName || !phone || !password) {
    return res.status(400).json({ code: 400, message: 'Missing required fields' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existing) {
    return res.status(409).json({ code: 409, message: 'Phone already registered' });
  }

  const id = 'U' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const hashedPassword = bcrypt.hashSync(password, 10);
  const now = Date.now();

  db.prepare(`
    INSERT INTO users (id, nickName, phone, password, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, nickName, phone, hashedPassword, now, now);

  const token = generateToken(id);
  res.json({
    code: 0,
    data: {
      token,
      userInfo: {
        id,
        nickName,
        phone,
        avatarUrl: '',
        schoolId: '',
        wallet: 0,
        bio: '',
        gender: '',
        grade: '',
        creditScore: 100,
        phoneBound: true,
        passwordSet: true,
        twoFAEnabled: false
      }
    },
    message: 'Register success'
  });
});

// Login
router.post('/login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ code: 400, message: 'Missing phone or password' });
  }

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ code: 401, message: 'Invalid phone or password' });
  }

  const token = generateToken(user.id);
  res.json({
    code: 0,
    data: {
      token,
      userInfo: {
        id: user.id,
        nickName: user.nickName,
        phone: user.phone,
        avatarUrl: user.avatarUrl || '',
        schoolId: user.schoolId || '',
        wallet: user.wallet || 0,
        bio: user.bio || '',
        gender: user.gender || '',
        grade: user.grade || '',
        creditScore: user.creditScore || 100,
        phoneBound: !!user.phone,
        passwordSet: !!user.password,
        twoFAEnabled: !!user.twoFAEnabled
      }
    },
    message: 'Login success'
  });
});

// WeChat login (mock - would integrate with WeChat SDK in production)
router.post('/wx-login', (req, res) => {
  const { code } = req.body;
  // In production, call WeChat API to exchange code for openid
  // For now, generate a mock user
  const id = 'U' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = Date.now();

  db.prepare(`
    INSERT INTO users (id, openid, nickName, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, 'wx_' + code, '微信用户', now, now);

  const token = generateToken(id);
  res.json({
    code: 0,
    data: {
      token,
      userInfo: {
        id,
        nickName: '微信用户',
        avatarUrl: '',
        schoolId: '',
        wallet: 0,
        bio: '',
        gender: '',
        grade: '',
        creditScore: 100,
        phoneBound: false,
        passwordSet: false,
        twoFAEnabled: false
      }
    },
    message: 'WeChat login success'
  });
});

module.exports = router;
