const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

// Get wallet balance
router.get('/balance', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT wallet FROM users WHERE id = ?').get(req.userId);
  res.json({ code: 0, data: { balance: user.wallet || 0 } });
});

// Get wallet history
router.get('/history', authMiddleware, (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const history = db.prepare('SELECT * FROM wallet_history WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?')
    .all(req.userId, parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  res.json({ code: 0, data: history });
});

// Recharge wallet (mock)
router.post('/recharge', authMiddleware, (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ code: 400, message: 'Invalid amount' });
  }
  db.prepare('UPDATE users SET wallet = wallet + ? WHERE id = ?').run(amount, req.userId);
  db.prepare('INSERT INTO wallet_history (userId, type, amount, balanceAfter, description, relatedId, createdAt) VALUES (?, ?, ?, (SELECT wallet FROM users WHERE id = ?), ?, ?, ?)')
    .run(req.userId, 'recharge', amount, req.userId, 'Wallet recharge', 'RECHARGE_' + Date.now(), Date.now());
  res.json({ code: 0, message: 'Recharge successful' });
});

module.exports = router;
