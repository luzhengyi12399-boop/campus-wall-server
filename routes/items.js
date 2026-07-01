const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// List items (marketplace)
router.get('/', (req, res) => {
  const { schoolId, category, status = 'available', page = 1, limit = 20 } = req.query;
  let sql = `
    SELECT i.*, u.nickName as sellerName, u.avatarUrl as sellerAvatar
    FROM items i
    JOIN users u ON i.userId = u.id
    WHERE i.status = ?
  `;
  const params = [status];
  if (schoolId) {
    sql += ' AND i.schoolId = ?';
    params.push(schoolId);
  }
  if (category) {
    sql += ' AND i.category = ?';
    params.push(category);
  }
  sql += ' ORDER BY i.createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const items = db.prepare(sql).all(...params);
  res.json({ code: 0, data: items });
});

// Create item
router.post('/', authMiddleware, (req, res) => {
  const { title, description, price, category, images, schoolId } = req.body;
  if (!title || price === undefined) {
    return res.status(400).json({ code: 400, message: 'Title and price required' });
  }
  const id = uuidv4();
  const now = Date.now();
  db.prepare('INSERT INTO items (id, userId, schoolId, title, description, price, category, images, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, schoolId || null, title, description || '', price, category || '', JSON.stringify(images || []), now);
  res.json({ code: 0, data: { id } });
});

// Get item by ID
router.get('/:id', (req, res) => {
  const item = db.prepare(`
    SELECT i.*, u.nickName as sellerName, u.avatarUrl as sellerAvatar
    FROM items i
    JOIN users u ON i.userId = u.id
    WHERE i.id = ?
  `).get(req.params.id);
  if (!item) {
    return res.status(404).json({ code: 404, message: 'Item not found' });
  }
  res.json({ code: 0, data: item });
});

// Update item
router.put('/:id', authMiddleware, (req, res) => {
  const { title, description, price, category, images, status } = req.body;
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) {
    return res.status(404).json({ code: 404, message: 'Item not found' });
  }
  if (item.userId !== req.userId) {
    return res.status(403).json({ code: 403, message: 'Not authorized' });
  }
  db.prepare('UPDATE items SET title = ?, description = ?, price = ?, category = ?, images = ?, status = ? WHERE id = ?')
    .run(title || item.title, description || item.description, price || item.price, category || item.category, JSON.stringify(images || JSON.parse(item.images || '[]')), status || item.status, req.params.id);
  res.json({ code: 0, message: 'Item updated' });
});

module.exports = router;
