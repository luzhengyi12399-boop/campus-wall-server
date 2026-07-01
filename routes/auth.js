const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { generateToken } = require('../auth');

const router = express.Router();

// Register with username + password
router.post('/register', (req, res) => {
  const { username, password, confirmPassword } = req.body;

  // Validate fields
  if (!username || !password || !confirmPassword) {
    return res.status(400).json({ code: 400, message: '请填写用户名、密码和确认密码' });
  }

  // Username: only letters and numbers, 4-20 chars
  if (!/^[a-zA-Z0-9]{4,20}$/.test(username)) {
    return res.status(400).json({ code: 400, message: '用户名只能由4-20位英文或数字组成' });
  }

  // Password: letters, numbers, punctuation, 6-30 chars
  if (!/^[a-zA-Z0-9\p{P}]{6,30}$/u.test(password)) {
    return res.status(400).json({ code: 400, message: '密码只能由6-30位英文、数字或标点符号组成' });
  }

  // Check confirm password
  if (password !== confirmPassword) {
    return res.status(400).json({ code: 400, message: '两次输入的密码不一致' });
  }

  // Check if username already exists
  const existing = db.prepare('SELECT id FROM users WHERE nickName = ?').get(username);
  if (existing) {
    return res.status(409).json({ code: 409, message: '该用户名已被注册' });
  }

  const id = 'U' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const hashedPassword = bcrypt.hashSync(password, 10);
  const now = Date.now();

  db.prepare(`
    INSERT INTO users (id, nickName, password, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, username, hashedPassword, now, now);

  const token = generateToken(id);
  res.json({
    code: 0,
    data: {
      token,
      userInfo: {
        id,
        nickName: username,
        avatarUrl: '',
        schoolId: '',
        wallet: 0,
        bio: '',
        gender: '',
        grade: '',
        creditScore: 100,
        phoneBound: false,
        passwordSet: true,
        twoFAEnabled: false
      }
    },
    message: '注册成功'
  });
});

// Login with username + password
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '请填写用户名和密码' });
  }

  const user = db.prepare('SELECT * FROM users WHERE nickName = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' });
  }

  const token = generateToken(user.id);
  res.json({
    code: 0,
    data: {
      token,
      userInfo: {
        id: user.id,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl || '',
        schoolId: user.schoolId || '',
        wallet: user.wallet || 0,
        bio: user.bio || '',
        gender: user.gender || '',
        grade: user.grade || '',
        creditScore: user.creditScore || 100,
        phoneBound: false,
        passwordSet: true,
        twoFAEnabled: false
      }
    },
    message: '登录成功'
  });
});

// WeChat login (mock - would integrate with WeChat SDK in production)
router.post('/wx-login', (req, res) => {
  const { code } = req.body;
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
