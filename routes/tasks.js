const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// List tasks
router.get('/', (req, res) => {
  const { schoolId, category, status = 'open', page = 1, limit = 20 } = req.query;
  let sql = `
    SELECT t.*, u.nickName as publisherName, u.avatarUrl as publisherAvatar
    FROM tasks t
    JOIN users u ON t.userId = u.id
    WHERE t.status = ?
  `;
  const params = [status];
  if (schoolId) {
    sql += ' AND t.schoolId = ?';
    params.push(schoolId);
  }
  if (category) {
    sql += ' AND t.category = ?';
    params.push(category);
  }
  sql += ' ORDER BY t.createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const tasks = db.prepare(sql).all(...params);
  res.json({ code: 0, data: tasks });
});

// Create task
router.post('/', authMiddleware, (req, res) => {
  const { title, description, reward, category, schoolId } = req.body;
  if (!title || reward === undefined) {
    return res.status(400).json({ code: 400, message: 'Title and reward required' });
  }
  const id = uuidv4();
  const now = Date.now();
  db.prepare('INSERT INTO tasks (id, userId, schoolId, title, description, reward, category, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, schoolId || null, title, description || '', reward, category || '', now);
  res.json({ code: 0, data: { id } });
});

// Get task by ID
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
  db.prepare('UPDATE tasks SET status = ?, assigneeId = ? WHERE id = ?')
    .run('in_progress', req.userId, req.params.id);
  res.json({ code: 0, message: 'Task accepted' });
});

// Submit task completion
router.post('/:id/submit', authMiddleware, (req, res) => {
  const { proof } = req.body;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) {
    return res.status(404).json({ code: 404, message: 'Task not found' });
  }
  if (task.assigneeId !== req.userId) {
    return res.status(403).json({ code: 403, message: 'Not assigned to you' });
  }
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('submitted', req.params.id);
  res.json({ code: 0, message: 'Task submitted for review' });
});

// Approve task completion (publisher only)
router.post('/:id/approve', authMiddleware, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) {
    return res.status(404).json({ code: 404, message: 'Task not found' });
  }
  if (task.userId !== req.userId) {
    return res.status(403).json({ code: 403, message: 'Only publisher can approve' });
  }
  if (task.status !== 'submitted') {
    return res.status(400).json({ code: 400, message: 'Task not submitted' });
  }
  // Transfer reward to assignee
  db.prepare('UPDATE users SET wallet = wallet + ? WHERE id = ?').run(task.reward, task.assigneeId);
  db.prepare('UPDATE users SET wallet = wallet - ? WHERE id = ?').run(task.reward, task.userId);
  db.prepare('INSERT INTO wallet_history (userId, type, amount, balance, description, relatedId, createdAt) VALUES (?, ?, ?, (SELECT wallet FROM users WHERE id = ?), ?, ?, ?)')
    .run(task.assigneeId, 'income', task.reward, task.assigneeId, 'Task reward', task.id, Date.now());
  db.prepare('UPDATE tasks SET status = ?, completedAt = ? WHERE id = ?')
    .run('completed', Date.now(), req.params.id);
  res.json({ code: 0, message: 'Task completed and reward transferred' });
});

module.exports = router;
