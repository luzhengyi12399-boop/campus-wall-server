const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get messages with a user
router.get('/:userId', authMiddleware, (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const messages = db.prepare(`
    SELECT m.*, u.nickName as senderName, u.avatarUrl as senderAvatar
    FROM messages m
    JOIN users u ON m.senderId = u.id
    WHERE (m.senderId = ? AND m.receiverId = ?) OR (m.senderId = ? AND m.receiverId = ?)
    ORDER BY m.createdAt DESC
    LIMIT ? OFFSET ?
  `).all(req.userId, req.params.userId, req.params.userId, req.userId, parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  res.json({ code: 0, data: messages });
});

// Send message
router.post('/', authMiddleware, (req, res) => {
  const { receiverId, content, type = 'text' } = req.body;
  if (!receiverId || !content) {
    return res.status(400).json({ code: 400, message: 'Receiver and content required' });
  }
  const id = uuidv4();
  const now = Date.now();
  db.prepare('INSERT INTO messages (id, senderId, receiverId, content, type, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, receiverId, content, type, now);
  // Update chat session
  const session = db.prepare('SELECT * FROM chat_sessions WHERE (userId1 = ? AND userId2 = ?) OR (userId1 = ? AND userId2 = ?)')
    .get(req.userId, receiverId, receiverId, req.userId);
  if (session) {
    const unreadField = session.userId1 === req.userId ? 'unread2' : 'unread1';
    db.prepare(`UPDATE chat_sessions SET lastMessageId = ?, lastMessageAt = ?, ${unreadField} = ${unreadField} + 1 WHERE id = ?`)
      .run(id, now, session.id);
  } else {
    db.prepare('INSERT INTO chat_sessions (userId1, userId2, lastMessageId, lastMessageAt, unread1, unread2) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.userId, receiverId, id, now, 0, 1);
  }
  res.json({ code: 0, data: { id } });
});

// Get chat sessions
router.get('/sessions/list', authMiddleware, (req, res) => {
  const sessions = db.prepare(`
    SELECT cs.*, 
      u1.nickName as user1Name, u1.avatarUrl as user1Avatar,
      u2.nickName as user2Name, u2.avatarUrl as user2Avatar,
      m.content as lastMessageContent
    FROM chat_sessions cs
    JOIN users u1 ON cs.userId1 = u1.id
    JOIN users u2 ON cs.userId2 = u2.id
    LEFT JOIN messages m ON cs.lastMessageId = m.id
    WHERE cs.userId1 = ? OR cs.userId2 = ?
    ORDER BY cs.lastMessageAt DESC
  `).all(req.userId, req.userId);
  res.json({ code: 0, data: sessions });
});

module.exports = router;
