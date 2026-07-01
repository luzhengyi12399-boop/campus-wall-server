const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// List posts
router.get('/', (req, res) => {
  const { schoolId, type, page = 1, limit = 20 } = req.query;
  let sql = `
    SELECT p.*, u.nickName as authorName, u.avatarUrl as authorAvatar
    FROM posts p
    JOIN users u ON p.userId = u.id
    WHERE 1=1
  `;
  const params = [];
  if (schoolId) {
    sql += ' AND p.schoolId = ?';
    params.push(schoolId);
  }
  if (type) {
    sql += ' AND p.type = ?';
    params.push(type);
  }
  sql += ' ORDER BY p.createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const posts = db.prepare(sql).all(...params);
  res.json({ code: 0, data: posts });
});

// Create post
router.post('/', authMiddleware, (req, res) => {
  const { schoolId, type, content, images } = req.body;
  if (!content) {
    return res.status(400).json({ code: 400, message: 'Content required' });
  }
  const id = uuidv4();
  const now = Date.now();
  db.prepare('INSERT INTO posts (id, schoolId, userId, type, content, images, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, schoolId || null, req.userId, type || 'text', content, JSON.stringify(images || []), now);
  res.json({ code: 0, data: { id } });
});

// Get post by ID
router.get('/:id', (req, res) => {
  const post = db.prepare(`
    SELECT p.*, u.nickName as authorName, u.avatarUrl as authorAvatar
    FROM posts p
    JOIN users u ON p.userId = u.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!post) {
    return res.status(404).json({ code: 404, message: 'Post not found' });
  }
  // Get comments
  const comments = db.prepare(`
    SELECT c.*, u.nickName as authorName, u.avatarUrl as authorAvatar
    FROM comments c
    JOIN users u ON c.userId = u.id
    WHERE c.postId = ?
    ORDER BY c.createdAt DESC
  `).all(req.params.id);
  post.commentList = comments;
  res.json({ code: 0, data: post });
});

// Like post
router.post('/:id/like', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM post_likes WHERE postId = ? AND userId = ?').get(req.params.id, req.userId);
  if (existing) {
    db.prepare('DELETE FROM post_likes WHERE postId = ? AND userId = ?').run(req.params.id, req.userId);
    db.prepare('UPDATE posts SET likes = likes - 1 WHERE id = ?').run(req.params.id);
    res.json({ code: 0, message: 'Unliked' });
  } else {
    db.prepare('INSERT INTO post_likes (postId, userId, createdAt) VALUES (?, ?, ?)').run(req.params.id, req.userId, Date.now());
    db.prepare('UPDATE posts SET likes = likes + 1 WHERE id = ?').run(req.params.id);
    res.json({ code: 0, message: 'Liked' });
  }
});

// Comment on post
router.post('/:id/comment', authMiddleware, (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ code: 400, message: 'Content required' });
  }
  db.prepare('INSERT INTO comments (postId, userId, content, createdAt) VALUES (?, ?, ?, ?)')
    .run(req.params.id, req.userId, content, Date.now());
  db.prepare('UPDATE posts SET comments = comments + 1 WHERE id = ?').run(req.params.id);
  res.json({ code: 0, message: 'Comment added' });
});

module.exports = router;
