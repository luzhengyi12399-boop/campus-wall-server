const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

// List tasks
router.get('/', (req, res) => {
  const { schoolId, status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT t.*, u.nickName as publisherName, u.avatarUrl as publisherAvatar
    FROM tasks t
    JOIN users u ON t.userId = u.id
    WHERE t.status != 'completed'
  `;
  const params = [];

  if (schoolId) {
    query += ' AND t.schoolId = ?';
    params.push(schoolId);
  }
  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }

  query += ' ORDER BY t.createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const tasks = db.prepare(query).all(...params);

  // Get accepted user info if any
  tasks.forEach(task => {
    if (task.images) {
      try { task.images = JSON.parse(task.images); } catch (e) { task.images = []; }
    } else {
      task.images = [];
    }
    if (task.acceptedBy) {
      const user = db.prepare('SELECT nickName, avatarUrl FROM users WHERE id = ?').get(task.acceptedBy);
      if (user) {
        task.acceptedUser = user;
      }
    }
  });

  res.json({ code: 0, data: tasks });
});

// Create task
router.post('/', authMiddleware, (req, res) => {
  const { title, description, reward, schoolId, channel, images, startTime, endTime } = req.body;
  if (!title || !reward) {
    return res.status(400).json({ code: 400, message: 'Title and reward required' });
  }

  // Check wallet balance
  const user = db.prepare('SELECT wallet FROM users WHERE id = ?').get(req.userId);
  if (!user || user.wallet < reward) {
    return res.status(400).json({ code: 400, message: 'Insufficient balance' });
  }

  // Deduct reward from wallet (freeze/escrow)
  db.prepare('UPDATE users SET wallet = wallet - ? WHERE id = ?').run(reward, req.userId);

  // Record wallet history
  db.prepare(`
    INSERT INTO wallet_history (userId, type, amount, balanceAfter, description, relatedId, createdAt)
    VALUES (?, 'deduct', ?, ?, 'Task reward escrow', ?, ?)
  `).run(req.userId, reward, user.wallet - reward, 'TASK_' + Date.now(), Date.now());

  const id = 'T' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = Date.now();

  db.prepare(`
    INSERT INTO tasks (id, userId, schoolId, title, description, reward, channel, images, status, startTime, endTime, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
  `).run(id, req.userId, schoolId || null, title, description || '', reward, channel || (schoolId ? 'school' : 'world'), JSON.stringify(images || []), startTime || null, endTime || null, now);

  res.json({ code: 0, data: { id }, message: 'Task created' });
});

// Get task detail
router.get('/:id', (req, res) => {
  const task = db.prepare(`
    SELECT t.*, u.nickName as publisherName, u.avatarUrl as publisherAvatar
    FROM tasks t
    JOIN users u ON t.userId = u.id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!task) {
    return res.status(404).json({ code: 404, message: 'Task not found' });
  }

  if (task.images) {
    try { task.images = JSON.parse(task.images); } catch (e) { task.images = []; }
  } else {
    task.images = [];
  }

  if (task.acceptedBy) {
    const user = db.prepare('SELECT nickName, avatarUrl FROM users WHERE id = ?').get(task.acceptedBy);
    task.acceptedUser = user || null;
  }

  res.json({ code: 0, data: task });
});

// Accept task
router.post('/:id/accept', authMiddleware, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) {
    return res.status(404).json({ code: 404, message: 'Task not found' });
  }
  if (task.status !== 'open') {
    return res.status(400).json({ code: 400, message: 'Task not available' });
  }
  if (task.userId === req.userId) {
    return res.status(400).json({ code: 400, message: 'Cannot accept own task' });
  }

  db.prepare('UPDATE tasks SET status = ?, acceptedBy = ?, acceptedAt = ? WHERE id = ?')
    .run('accepted', req.userId, Date.now(), req.params.id);

  // Notify publisher
  db.prepare(`
    INSERT INTO notifications (userId, type, title, content, data, createdAt)
    VALUES (?, 'task', '任务被接单', '您的任务已被接单', ?, ?)
  `).run(task.userId, JSON.stringify({ taskId: task.id }), Date.now());

  res.json({ code: 0, message: 'Task accepted' });
});

// Submit task
router.post('/:id/submit', authMiddleware, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) {
    return res.status(404).json({ code: 404, message: 'Task not found' });
  }
  if (task.acceptedBy !== req.userId) {
    return res.status(403).json({ code: 403, message: 'Not assigned to you' });
  }
  if (task.status !== 'accepted') {
    return res.status(400).json({ code: 400, message: 'Task not in accepted status' });
  }

  db.prepare('UPDATE tasks SET status = ?, submittedAt = ? WHERE id = ?')
    .run('submitted', Date.now(), req.params.id);

  // Notify publisher
  db.prepare(`
    INSERT INTO notifications (userId, type, title, content, data, createdAt)
    VALUES (?, 'task', '任务已提交', '您的任务已提交验收', ?, ?)
  `).run(task.userId, JSON.stringify({ taskId: task.id }), Date.now());

  res.json({ code: 0, message: 'Task submitted' });
});

// Verify task (approve/reject)
router.post('/:id/verify', authMiddleware, (req, res) => {
  const { approved } = req.body;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) {
    return res.status(404).json({ code: 404, message: 'Task not found' });
  }
  if (task.userId !== req.userId) {
    return res.status(403).json({ code: 403, message: 'Not publisher' });
  }
  if (task.status !== 'submitted') {
    return res.status(400).json({ code: 400, message: 'Task not submitted' });
  }

  if (approved) {
    // Transfer reward to accepted user
    const acceptedUser = db.prepare('SELECT wallet FROM users WHERE id = ?').get(task.acceptedBy);
    db.prepare('UPDATE users SET wallet = wallet + ? WHERE id = ?').run(task.reward, task.acceptedBy);

    // Record wallet history
    db.prepare(`
      INSERT INTO wallet_history (userId, type, amount, balanceAfter, description, relatedId, createdAt)
      VALUES (?, 'add', ?, ?, 'Task reward', ?, ?)
    `).run(task.acceptedBy, task.reward, (acceptedUser.wallet || 0) + task.reward, task.id, Date.now());

    db.prepare('UPDATE tasks SET status = ?, completedAt = ? WHERE id = ?')
      .run('completed', Date.now(), req.params.id);

    // Notify accepted user
    db.prepare(`
      INSERT INTO notifications (userId, type, title, content, data, createdAt)
      VALUES (?, 'task', '任务验收通过', '您的任务已通过验收，赏金已到账', ?, ?)
    `).run(task.acceptedBy, JSON.stringify({ taskId: task.id }), Date.now());
  } else {
    // Refund publisher
    const publisher = db.prepare('SELECT wallet FROM users WHERE id = ?').get(task.userId);
    db.prepare('UPDATE users SET wallet = wallet + ? WHERE id = ?').run(task.reward, task.userId);

    db.prepare(`
      INSERT INTO wallet_history (userId, type, amount, balanceAfter, description, relatedId, createdAt)
      VALUES (?, 'add', ?, ?, 'Task refund', ?, ?)
    `).run(task.userId, task.reward, (publisher.wallet || 0) + task.reward, task.id, Date.now());

    db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('open', req.params.id);

    // Notify accepted user
    db.prepare(`
      INSERT INTO notifications (userId, type, title, content, data, createdAt)
      VALUES (?, 'task', '任务验收驳回', '您的任务被驳回，任务已重新开放', ?, ?)
    `).run(task.acceptedBy, JSON.stringify({ taskId: task.id }), Date.now());
  }

  res.json({ code: 0, message: approved ? 'Task approved' : 'Task rejected' });
});

module.exports = router;
