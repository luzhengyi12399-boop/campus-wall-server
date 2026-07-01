const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../auth');

const router = express.Router();

// Create group
router.post('/', authMiddleware, (req, res) => {
  const { name, avatar } = req.body;
  if (!name) {
    return res.status(400).json({ code: 400, message: 'Group name required' });
  }

  const id = 'G' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = Date.now();

  db.prepare(`
    INSERT INTO groups (id, name, avatar, createdBy, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, avatar || '', req.userId, now);

  db.prepare('INSERT INTO group_members (groupId, userId, role, joinedAt) VALUES (?, ?, ?, ?)')
    .run(id, req.userId, 'admin', now);

  res.json({ code: 0, data: { id }, message: 'Group created' });
});

// Get group list (joined)
router.get('/', authMiddleware, (req, res) => {
  const groups = db.prepare(`
    SELECT g.*, gm.role as myRole,
           (SELECT COUNT(*) FROM group_members WHERE groupId = g.id) as memberCount
    FROM groups g
    JOIN group_members gm ON g.id = gm.groupId
    WHERE gm.userId = ?
    ORDER BY g.createdAt DESC
  `).all(req.userId);

  res.json({ code: 0, data: groups });
});

// Get group detail
router.get('/:id', authMiddleware, (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) {
    return res.status(404).json({ code: 404, message: 'Group not found' });
  }

  const members = db.prepare(`
    SELECT gm.*, u.nickName, u.avatarUrl
    FROM group_members gm
    JOIN users u ON gm.userId = u.id
    WHERE gm.groupId = ?
    ORDER BY gm.joinedAt ASC
  `).all(req.params.id);

  const myRole = db.prepare('SELECT role FROM group_members WHERE groupId = ? AND userId = ?').get(req.params.id, req.userId);

  res.json({ code: 0, data: { ...group, members, myRole: myRole ? myRole.role : null } });
});

// Add member to group
router.post('/:id/members', authMiddleware, (req, res) => {
  const { userId } = req.body;
  const groupId = req.params.id;

  const myRole = db.prepare('SELECT role FROM group_members WHERE groupId = ? AND userId = ?').get(groupId, req.userId);
  if (!myRole || myRole.role !== 'admin') {
    return res.status(403).json({ code: 403, message: 'Admin only' });
  }

  const existing = db.prepare('SELECT id FROM group_members WHERE groupId = ? AND userId = ?').get(groupId, userId);
  if (existing) {
    return res.status(409).json({ code: 409, message: 'Already a member' });
  }

  db.prepare('INSERT INTO group_members (groupId, userId, role, joinedAt) VALUES (?, ?, ?, ?)')
    .run(groupId, userId, 'member', Date.now());

  res.json({ code: 0, message: 'Member added' });
});

// Remove member from group
router.delete('/:id/members/:userId', authMiddleware, (req, res) => {
  const groupId = req.params.id;
  const userId = req.params.userId;

  const myRole = db.prepare('SELECT role FROM group_members WHERE groupId = ? AND userId = ?').get(groupId, req.userId);
  if (!myRole || myRole.role !== 'admin') {
    return res.status(403).json({ code: 403, message: 'Admin only' });
  }

  db.prepare('DELETE FROM group_members WHERE groupId = ? AND userId = ?').run(groupId, userId);
  res.json({ code: 0, message: 'Member removed' });
});

module.exports = router;
