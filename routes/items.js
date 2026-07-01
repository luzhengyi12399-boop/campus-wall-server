const express = require('express');
const db = require('../database');
const { authMiddleware, optionalAuth } = require('../auth');

const router = express.Router();

// List items
router.get('/', optionalAuth, (req, res) => {
  const { schoolId, category, status, page = 1, limit = 20, search } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT i.*, u.nickName, u.avatarUrl
    FROM items i
    JOIN users u ON i.userId = u.id
    WHERE 1=1
  `;
  const params = [];

  if (schoolId) {
    query += ' AND i.schoolId = ?';
    params.push(schoolId);
  }
  if (category) {
    query += ' AND i.category = ?';
    params.push(category);
  }
  if (status) {
    query += ' AND i.status = ?';
    params.push(status);
  } else {
    query += ` AND i.status = 'selling'`;
  }
  if (search) {
    query += ' AND (i.title LIKE ? OR i.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY i.createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const items = db.prepare(query).all(...params);

  // Parse images
  items.forEach(item => {
    try {
      item.images = JSON.parse(item.images || '[]');
    } catch (e) {
      item.images = [];
    }
  });

  // Parse images and add seller info
  items.forEach(item => {
    try {
      item.images = JSON.parse(item.images || '[]');
    } catch (e) {
      item.images = [];
    }
    item.seller = item.userId;
    item.sellerName = item.nickName;
  });

  res.json({ code: 0, data: items });
});

// Create item
router.post('/', authMiddleware, (req, res) => {
  const { title, description, price, originalPrice, images, category, tags, condition, schoolId } = req.body;
  if (!title || !price) {
    return res.status(400).json({ code: 400, message: 'Title and price required' });
  }

  const id = 'I' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = Date.now();

  db.prepare(`
    INSERT INTO items (id, userId, schoolId, title, description, price, originalPrice, images, category, tags, condition, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'selling', ?)
  `).run(id, req.userId, schoolId || null, title, description || '', price, originalPrice || null, JSON.stringify(images || []), category || '', tags || '', condition || '', now);

  res.json({ code: 0, data: { id }, message: 'Item created' });
});

// Get item detail
router.get('/:id', optionalAuth, (req, res) => {
  const item = db.prepare(`
    SELECT i.*, u.nickName, u.avatarUrl
    FROM items i
    JOIN users u ON i.userId = u.id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!item) {
    return res.status(404).json({ code: 404, message: 'Item not found' });
  }

  try {
    item.images = JSON.parse(item.images || '[]');
  } catch (e) {
    item.images = [];
  }
  item.seller = item.userId;
  item.sellerName = item.nickName;

  res.json({ code: 0, data: item });
});

// Update item
router.put('/:id', authMiddleware, (req, res) => {
  const item = db.prepare('SELECT userId FROM items WHERE id = ?').get(req.params.id);
  if (!item) {
    return res.status(404).json({ code: 404, message: 'Item not found' });
  }
  if (item.userId !== req.userId) {
    return res.status(403).json({ code: 403, message: 'Not owner' });
  }

  const { title, description, price, images, category, condition, status } = req.body;
  db.prepare(`
    UPDATE items SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      images = COALESCE(?, images),
      category = COALESCE(?, category),
      condition = COALESCE(?, condition),
      status = COALESCE(?, status)
    WHERE id = ?
  `).run(title, description, price, images ? JSON.stringify(images) : null, category, condition, status, req.params.id);

  res.json({ code: 0, message: 'Item updated' });
});

// Delete item
router.delete('/:id', authMiddleware, (req, res) => {
  const item = db.prepare('SELECT userId FROM items WHERE id = ?').get(req.params.id);
  if (!item) {
    return res.status(404).json({ code: 404, message: 'Item not found' });
  }
  if (item.userId !== req.userId) {
    return res.status(403).json({ code: 403, message: 'Not owner' });
  }

  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ code: 0, message: 'Item deleted' });
});

module.exports = router;
