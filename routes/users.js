const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) {
    return res.status(404).json({ code: 404, message: 'User not found' });
  }

  res.json({
    code: 0,
    data: {
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
  });
});

// Update profile
router.put('/profile', authMiddleware, (req, res) => {
  const { nickName, avatarUrl, bio, gender, grade } = req.body;
  const now = Date.now();

  db.prepare(`
    UPDATE users SET
      nickName = COALESCE(?, nickName),
      avatarUrl = COALESCE(?, avatarUrl),
      bio = COALESCE(?, bio),
      gender = COALESCE(?, gender),
      grade = COALESCE(?, grade),
      updatedAt = ?
    WHERE id = ?
  `).run(nickName, avatarUrl, bio, gender, grade, now, req.userId);

  res.json({ code: 0, message: 'Profile updated' });
});

// Bind phone
router.post('/bind-phone', authMiddleware, (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ code: 400, message: 'Phone required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(phone, req.userId);
  if (existing) {
    return res.status(409).json({ code: 409, message: 'Phone already bound' });
  }

  db.prepare('UPDATE users SET phone = ?, updatedAt = ? WHERE id = ?').run(phone, Date.now(), req.userId);
  res.json({ code: 0, message: 'Phone bound successfully' });
});

// Set password
router.post('/set-password', authMiddleware, (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ code: 400, message: 'Password must be at least 6 characters' });
  }

  const bcrypt = require('bcryptjs');
  const hashed = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password = ?, updatedAt = ? WHERE id = ?').run(hashed, Date.now(), req.userId);
  res.json({ code: 0, message: 'Password set successfully' });
});

// Get user by ID (public info)
router.get('/:id', (req, res) => {
  const user = db.prepare('SELECT id, nickName, avatarUrl, schoolId FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ code: 404, message: 'User not found' });
  }
  res.json({ code: 0, data: user });
});

module.exports = router;
