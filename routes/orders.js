const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

// Create order
router.post('/', authMiddleware, (req, res) => {
  const { itemId, address } = req.body;
  if (!itemId) {
    return res.status(400).json({ code: 400, message: 'Item ID required' });
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
  if (!item) {
    return res.status(404).json({ code: 404, message: 'Item not found' });
  }
  if (item.status !== 'selling') {
    return res.status(400).json({ code: 400, message: 'Item not available' });
  }
  if (item.userId === req.userId) {
    return res.status(400).json({ code: 400, message: 'Cannot buy own item' });
  }

  const buyer = db.prepare('SELECT wallet FROM users WHERE id = ?').get(req.userId);
  if (!buyer || buyer.wallet < item.price) {
    return res.status(400).json({ code: 400, message: 'Insufficient balance' });
  }

  const id = 'O' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = Date.now();

  // Deduct buyer wallet
  db.prepare('UPDATE users SET wallet = wallet - ? WHERE id = ?').run(item.price, req.userId);
  db.prepare(`
    INSERT INTO wallet_history (userId, type, amount, balanceAfter, description, relatedId, createdAt)
    VALUES (?, 'deduct', ?, ?, 'Order payment', ?, ?)
  `).run(req.userId, item.price, buyer.wallet - item.price, id, now);

  // Mark item as sold
  db.prepare('UPDATE items SET status = ? WHERE id = ?').run('sold', itemId);

  db.prepare(`
    INSERT INTO orders (id, itemId, buyerId, sellerId, price, status, address, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, itemId, req.userId, item.userId, item.price, 'paid', address || '', now);

  // Notify seller
  db.prepare(`
    INSERT INTO notifications (userId, type, title, content, data, createdAt)
    VALUES (?, 'order', '新订单', '您有新的订单', ?, ?)
  `).run(item.userId, JSON.stringify({ orderId: id }), now);

  res.json({ code: 0, data: { id }, message: 'Order created' });
});

// List my orders (as buyer or seller)
router.get('/', authMiddleware, (req, res) => {
  const { type, status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT o.*, i.title as itemTitle, i.images as itemImages,
           b.nickName as buyerName, b.avatarUrl as buyerAvatar,
           s.nickName as sellerName, s.avatarUrl as sellerAvatar
    FROM orders o
    JOIN items i ON o.itemId = i.id
    JOIN users b ON o.buyerId = b.id
    JOIN users s ON o.sellerId = s.id
    WHERE 1=1
  `;
  const params = [];

  if (type === 'buyer') {
    query += ' AND o.buyerId = ?';
    params.push(req.userId);
  } else if (type === 'seller') {
    query += ' AND o.sellerId = ?';
    params.push(req.userId);
  } else {
    query += ' AND (o.buyerId = ? OR o.sellerId = ?)';
    params.push(req.userId, req.userId);
  }

  if (status) {
    query += ' AND o.status = ?';
    params.push(status);
  }

  query += ' ORDER BY o.createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const orders = db.prepare(query).all(...params);

  orders.forEach(order => {
    try {
      order.itemImages = JSON.parse(order.itemImages || '[]');
    } catch (e) {
      order.itemImages = [];
    }
  });

  res.json({ code: 0, data: orders });
});

// Get order detail
router.get('/:id', authMiddleware, (req, res) => {
  const order = db.prepare(`
    SELECT o.*, i.title as itemTitle, i.images as itemImages, i.description as itemDescription,
           b.nickName as buyerName, b.avatarUrl as buyerAvatar,
           s.nickName as sellerName, s.avatarUrl as sellerAvatar
    FROM orders o
    JOIN items i ON o.itemId = i.id
    JOIN users b ON o.buyerId = b.id
    JOIN users s ON o.sellerId = s.id
    WHERE o.id = ? AND (o.buyerId = ? OR o.sellerId = ?)
  `).get(req.params.id, req.userId, req.userId);

  if (!order) {
    return res.status(404).json({ code: 404, message: 'Order not found' });
  }

  try {
    order.itemImages = JSON.parse(order.itemImages || '[]');
  } catch (e) {
    order.itemImages = [];
  }

  res.json({ code: 0, data: order });
});

// Ship order
router.post('/:id/ship', authMiddleware, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) {
    return res.status(404).json({ code: 404, message: 'Order not found' });
  }
  if (order.sellerId !== req.userId) {
    return res.status(403).json({ code: 403, message: 'Not seller' });
  }
  if (order.status !== 'paid') {
    return res.status(400).json({ code: 400, message: 'Order not in paid status' });
  }

  db.prepare('UPDATE orders SET status = ?, shippedAt = ? WHERE id = ?')
    .run('shipped', Date.now(), req.params.id);

  // Notify buyer
  db.prepare(`
    INSERT INTO notifications (userId, type, title, content, data, createdAt)
    VALUES (?, 'order', '订单已发货', '您的订单已发货', ?, ?)
  `).run(order.buyerId, JSON.stringify({ orderId: order.id }), Date.now());

  res.json({ code: 0, message: 'Order shipped' });
});

// Confirm receipt
router.post('/:id/confirm', authMiddleware, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) {
    return res.status(404).json({ code: 404, message: 'Order not found' });
  }
  if (order.buyerId !== req.userId) {
    return res.status(403).json({ code: 403, message: 'Not buyer' });
  }
  if (order.status !== 'shipped') {
    return res.status(400).json({ code: 400, message: 'Order not shipped' });
  }

  const seller = db.prepare('SELECT wallet FROM users WHERE id = ?').get(order.sellerId);
  db.prepare('UPDATE users SET wallet = wallet + ? WHERE id = ?').run(order.price, order.sellerId);

  db.prepare(`
    INSERT INTO wallet_history (userId, type, amount, balanceAfter, description, relatedId, createdAt)
    VALUES (?, 'add', ?, ?, 'Order income', ?, ?)
  `).run(order.sellerId, order.price, (seller.wallet || 0) + order.price, order.id, Date.now());

  db.prepare('UPDATE orders SET status = ?, completedAt = ? WHERE id = ?')
    .run('completed', Date.now(), req.params.id);

  // Notify seller
  db.prepare(`
    INSERT INTO notifications (userId, type, title, content, data, createdAt)
    VALUES (?, 'order', '订单已完成', '买家已确认收货，资金已到账', ?, ?)
  `).run(order.sellerId, JSON.stringify({ orderId: order.id }), Date.now());

  res.json({ code: 0, message: 'Order confirmed' });
});

module.exports = router;
