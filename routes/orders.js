const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// List orders
router.get('/', authMiddleware, (req, res) => {
  const { type, status, page = 1, limit = 20 } = req.query;
  let sql = `
    SELECT o.*, 
      buyer.nickName as buyerName, buyer.avatarUrl as buyerAvatar,
      seller.nickName as sellerName, seller.avatarUrl as sellerAvatar
    FROM orders o
    JOIN users buyer ON o.buyerId = buyer.id
    JOIN users seller ON o.sellerId = seller.id
    WHERE o.buyerId = ? OR o.sellerId = ?
  `;
  const params = [req.userId, req.userId];
  if (status) {
    sql += ' AND o.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY o.createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const orders = db.prepare(sql).all(...params);
  res.json({ code: 0, data: orders });
});

// Create order (buy item)
router.post('/buy', authMiddleware, (req, res) => {
  const { itemId } = req.body;
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
  if (!item) {
    return res.status(404).json({ code: 404, message: 'Item not found' });
  }
  if (item.status !== 'available') {
    return res.status(400).json({ code: 400, message: 'Item not available' });
  }
  if (item.userId === req.userId) {
    return res.status(400).json({ code: 400, message: 'Cannot buy own item' });
  }
  const buyer = db.prepare('SELECT wallet FROM users WHERE id = ?').get(req.userId);
  if (buyer.wallet < item.price) {
    return res.status(400).json({ code: 400, message: 'Insufficient balance' });
  }
  const id = uuidv4();
  const now = Date.now();
  db.prepare('INSERT INTO orders (id, buyerId, sellerId, itemId, amount, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, item.userId, itemId, item.price, 'pending', now, now);
  db.prepare('UPDATE items SET status = ? WHERE id = ?').run('reserved', itemId);
  res.json({ code: 0, data: { id } });
});

// Pay order
router.post('/:id/pay', authMiddleware, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) {
    return res.status(404).json({ code: 404, message: 'Order not found' });
  }
  if (order.buyerId !== req.userId) {
    return res.status(403).json({ code: 403, message: 'Not your order' });
  }
  if (order.status !== 'pending') {
    return res.status(400).json({ code: 400, message: 'Order not pending' });
  }
  const buyer = db.prepare('SELECT wallet FROM users WHERE id = ?').get(req.userId);
  if (buyer.wallet < order.amount) {
    return res.status(400).json({ code: 400, message: 'Insufficient balance' });
  }
  const now = Date.now();
  // Deduct from buyer
  db.prepare('UPDATE users SET wallet = wallet - ? WHERE id = ?').run(order.amount, req.userId);
  db.prepare('INSERT INTO wallet_history (userId, type, amount, balance, description, relatedId, createdAt) VALUES (?, ?, ?, (SELECT wallet FROM users WHERE id = ?), ?, ?, ?)')
    .run(req.userId, 'expense', -order.amount, req.userId, 'Order payment', order.id, now);
  // Add to seller (escrow - hold until confirmed)
  db.prepare('UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?').run('paid', now, req.params.id);
  res.json({ code: 0, message: 'Payment successful' });
});

// Confirm receipt (buyer confirms, release to seller)
router.post('/:id/confirm', authMiddleware, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) {
    return res.status(404).json({ code: 404, message: 'Order not found' });
  }
  if (order.buyerId !== req.userId) {
    return res.status(403).json({ code: 403, message: 'Not your order' });
  }
  if (order.status !== 'paid') {
    return res.status(400).json({ code: 400, message: 'Order not paid' });
  }
  const now = Date.now();
  db.prepare('UPDATE users SET wallet = wallet + ? WHERE id = ?').run(order.amount, order.sellerId);
  db.prepare('INSERT INTO wallet_history (userId, type, amount, balance, description, relatedId, createdAt) VALUES (?, ?, ?, (SELECT wallet FROM users WHERE id = ?), ?, ?, ?)')
    .run(order.sellerId, 'income', order.amount, order.sellerId, 'Order income', order.id, now);
  db.prepare('UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?').run('completed', now, req.params.id);
  db.prepare('UPDATE items SET status = ? WHERE id = ?').run('sold', order.itemId);
  res.json({ code: 0, message: 'Order confirmed' });
});

module.exports = router;
