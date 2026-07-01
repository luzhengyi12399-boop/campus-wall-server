const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get friend list
router.get('/', authMiddleware, (req, res) => {
  const friends = db.prepare(`
    SELECT u.id, u.nickName, u.avatarUrl, f.createdAt
    FROM friends f
    JOIN users u ON (f.userId1 = u.id OR f.userId2 = u.id)
    WHERE (f.userId1 = ? OR f.userId2 = ?) AND u.id != ?
  `).all(req.userId, req.userId, req.userId);
  res.json({ code: 0, data: friends });
});

// Send friend request
router.post('/request', authMiddleware, (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ code: 400, message: 'User ID required' });
  }
  if (userId === req.userId) {
    return res.status(400).json({ code: 400, message: 'Cannot add yourself' });
  }
  const existing = db.prepare('SELECT * FROM friends WHERE (userId1 = ? AND userId2 = ?) OR (userId1 = ? AND userId2 = ?)')
    .get(req.userId, userId, userId, req.userId);
  if (existing) {
    return res.status(400).json({ code: 400, message: 'Already friends' });
  }
  const pending = db.prepare('SELECT * FROM friend_requests WHERE senderId = ? AND receiverId = ? AND status = ?')
    .get(req.userId, userId, 'pending');
  if (pending) {
    return res.status(400).json({ code: 400, message: 'Request already sent' });
  }
  db.prepare('INSERT INTO friend_requests (senderId, receiverId, status, createdAt) VALUES (?, ?, ?, ?)')
    .run(req.userId, userId, 'pending', Date.now());
  res.json({ code: 0, message: 'Friend request sent' });
});

// Get pending friend requests
router.get('/requests', authMiddleware, (req, res) => {
  const requests = db.prepare(`
    SELECT fr.*, u.nickName as senderName, u.avatarUrl as senderAvatar
    FROM friend_requests fr
    JOIN users u ON fr.senderId = u.id
    WHERE fr.receiverId = ? AND fr.status = ?
    ORDER BY fr.createdAt DESC
  `).all(req.userId, 'pending');
  res.json({ code: 0, data: requests });
});

// Accept friend request
router.post('/accept', authMiddleware, (req, res) => {
  const { requestId } = req.body;
  const request = db.prepare('SELECT * FROM friend_requests WHERE id = ?').get(requestId);
  if (!request) {
    return res.status(404).json({ code: 404, message: 'Request not found' });
  }
  if (request.receiverId !== req.userId) {
    return res.status(403).json({ code: 403, message: 'Not your request' });
  }
  db.prepare('UPDATE friend_requests SET status = ? WHERE id = ?').run('accepted', requestId);
  db.prepare('INSERT INTO friends (userId1, userId2, createdAt) VALUES (?, ?, ?)')
    .run(request.senderId, request.receiverId, Date.now());
  res.json({ code: 0, message: 'Friend request accepted' });
});

module.exports = router;
