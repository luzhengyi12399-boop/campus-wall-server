const express = require('express');
const db = require('../database');
const { authMiddleware, optionalAuth } = require('../auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// List posts
router.get('/', optionalAuth, (req, res) => {
  const { schoolId, type, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT p.id, p.schoolId, p.userId, p.type, p.content, p.images, p.status, p.createdAt,
           u.nickName, u.avatarUrl,
           (SELECT COUNT(*) FROM post_likes WHERE postId = p.id) as likes,
           (SELECT COUNT(*) FROM comments WHERE postId = p.id) as comments
    FROM posts p
    JOIN users u ON p.userId = u.id
    WHERE 1=1
  `;
  const params = [];

  if (schoolId) {
    query += ' AND p.schoolId = ?';
    params.push(schoolId);
  }
  if (type) {
    query += ' AND p.type = ?';
    params.push(type);
  }

  // For non-logged-in users, only show approved posts from any school (world feed)
  // For logged-in users, show approved posts from their school and world
  if (req.userId) {
    const user = db.prepare('SELECT schoolId FROM users WHERE id = ?').get(req.userId);
    if (user && user.schoolId) {
      query += ' AND (p.schoolId = ? OR p.schoolId IS NULL)';
      params.push(user.schoolId);
    } else {
      query += ' AND p.schoolId IS NULL';
    }
  } else {
    query += ' AND p.schoolId IS NULL';
  }

  query += ' AND p.status = "approved" ORDER BY p.createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const posts = db.prepare(query).all(...params);

  // Parse images JSON
  posts.forEach(post => {
    try {
      post.images = JSON.parse(post.images || '[]');
    } catch (e) {
      post.images = [];
    }
  });

  res.json({ code: 0, data: posts });
});

// Create post
router.post('/', authMiddleware, (req, res) => {
  const { content, images, type, schoolId } = req.body;
  if (!content) {
    return res.status(400).json({ code: 400, message: 'Content required' });
  }

  const id = 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = Date.now();

  // Check if school requires review
  let status = 'approved';
  if (schoolId) {
    const school = db.prepare('SELECT reviewRequired FROM schools WHERE id = ?').get(schoolId);
    if (school && school.reviewRequired) {
      status = 'pending';
    }
  }

  db.prepare(`
    INSERT INTO posts (id, schoolId, userId, type, content, images, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, schoolId || null, req.userId, type || 'text', content, JSON.stringify(images || []), status, now);

  res.json({ code: 0, data: { id, status }, message: 'Post created' });
});

// Get post detail
router.get('/:id', optionalAuth, (req, res) => {
  const post = db.prepare(`
    SELECT p.*, u.nickName, u.avatarUrl
    FROM posts p
    JOIN users u ON p.userId = u.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!post) {
    return res.status(404).json({ code: 404, message: 'Post not found' });
  }

  // Parse images
  try {
    post.images = JSON.parse(post.images || '[]');
  } catch (e) {
    post.images = [];
  }

  // Get comments
  const comments = db.prepare(`
    SELECT c.*, u.nickName, u.avatarUrl
    FROM comments c
    JOIN users u ON c.userId = u.id
    WHERE c.postId = ?
    ORDER BY c.createdAt DESC
  `).all(req.params.id);

  post.comments = comments;

  // Check if liked by current user
  if (req.userId) {
    const liked = db.prepare('SELECT id FROM post_likes WHERE postId = ? AND userId = ?').get(req.params.id, req.userId);
    post.isLiked = !!liked;
  }

  res.json({ code: 0, data: post });
});

// Like/unlike post
router.post('/:id/like', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT id FROM post_likes WHERE postId = ? AND userId = ?').get(req.params.id, req.userId);
  if (existing) {
    db.prepare('DELETE FROM post_likes WHERE id = ?').run(existing.id);
    res.json({ code: 0, message: 'Unliked', data: { isLiked: false } });
  } else {
    db.prepare('INSERT INTO post_likes (postId, userId) VALUES (?, ?)').run(req.params.id, req.userId);
    res.json({ code: 0, message: 'Liked', data: { isLiked: true } });
  }
});

// Add comment
router.post('/:id/comments', authMiddleware, (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ code: 400, message: 'Content required' });
  }

  db.prepare('INSERT INTO comments (postId, userId, content, createdAt) VALUES (?, ?, ?, ?)')
    .run(req.params.id, req.userId, content, Date.now());

  res.json({ code: 0, message: 'Comment added' });
});

// Approve/reject post (school admin)
router.put('/:id/status', authMiddleware, (req, res) => {
  const { status } = req.body;
  const post = db.prepare('SELECT schoolId, userId FROM posts WHERE id = ?').get(req.params.id);
  if (!post) {
    return res.status(404).json({ code: 404, message: 'Post not found' });
  }

  // Check if user is school admin
  const membership = db.prepare('SELECT role FROM school_members WHERE schoolId = ? AND userId = ?').get(post.schoolId, req.userId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).json({ code: 403, message: 'Admin only' });
  }

  db.prepare('UPDATE posts SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ code: 0, message: `Post ${status}` });
});

module.exports = router;
