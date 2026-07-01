const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

// Get notifications
router.get('/', authMiddleware, (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  let sql = 'SELECT * FROM notifications WHERE userId = ?';
  const params = [req.userId];
  if (unreadOnly === 'true') {
    sql += ' AND read = 0';
  }
  sql += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const notifications = db.prepare(sql).all(...params);
  res.json({ code: 0, data: notifications });
});

// Mark as read
router.post('/:id/read', authMiddleware, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND userId = ?').run(req.params.id, req.userId);
  res.json({ code: 0, message: 'Marked as read' });
});

// Mark all as read
router.post('/read-all', authMiddleware, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE userId = ?').run(req.userId);
  res.json({ code: 0, message: 'All marked as read' });
});

// Get unread count
router.get('/unread-count', authMiddleware, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND read = 0').get(req.userId);
  res.json({ code: 0, data: count.count });
});

module.exports = router;
