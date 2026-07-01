const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// List groups
router.get('/', (req, res) => {
  const { schoolId, page = 1, limit = 20 } = req.query;
  let sql = 'SELECT g.*, u.nickName as creatorName FROM groups g JOIN users u ON g.creatorId = u.id WHERE 1=1';
  const params = [];
  if (schoolId) {
    sql += ' AND g.schoolId = ?';
    params.push(schoolId);
  }
  sql += ' ORDER BY g.createdAt DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const groups = db.prepare(sql).all(...params);
  res.json({ code: 0, data: groups });
});

// Create group
router.post('/', authMiddleware, (req, res) => {
  const { name, description, avatar, schoolId } = req.body;
  if (!name) {
    return res.status(400).json({ code: 400, message: 'Group name required' });
  }
  const id = uuidv4();
  const now = Date.now();
  db.prepare('INSERT INTO groups (id, name, description, avatar, creatorId, schoolId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, description || '', avatar || '', req.userId, schoolId || null, now);
  db.prepare('INSERT INTO group_members (groupId, userId, role, joinedAt) VALUES (?, ?, ?, ?)')
    .run(id, req.userId, 'admin', now);
  res.json({ code: 0, data: { id } });
});

// Get group by ID
router.get('/:id', (req, res) => {
  const group = db.prepare(`
    SELECT g.*, u.nickName as creatorName
    FROM groups g
    JOIN users u ON g.creatorId = u.id
    WHERE g.id = ?
  `).get(req.params.id);
  if (!group) {
    return res.status(404).json({ code: 404, message: 'Group not found' });
  }
  const members = db.prepare(`
    SELECT gm.*, u.nickName, u.avatarUrl
    FROM group_members gm
    JOIN users u ON gm.userId = u.id
    WHERE gm.groupId = ?
  `).all(req.params.id);
  group.members = members;
  res.json({ code: 0, data: group });
});

// Join group
router.post('/:id/join', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM group_members WHERE groupId = ? AND userId = ?').get(req.params.id, req.userId);
  if (existing) {
    return res.status(400).json({ code: 400, message: 'Already a member' });
  }
  db.prepare('INSERT INTO group_members (groupId, userId, role, joinedAt) VALUES (?, ?, ?, ?)')
    .run(req.params.id, req.userId, 'member', Date.now());
  res.json({ code: 0, message: 'Joined group' });
});

module.exports = router;
