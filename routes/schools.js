const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// List all schools
router.get('/', (req, res) => {
  const schools = db.prepare('SELECT * FROM schools ORDER BY createdAt DESC').all();
  res.json({ code: 0, data: schools });
});

// Create school
router.post('/', authMiddleware, (req, res) => {
  const { name, description, logo, inviteCode, reviewRequired } = req.body;
  if (!name) {
    return res.status(400).json({ code: 400, message: 'School name required' });
  }
  const id = uuidv4();
  const code = inviteCode || Math.random().toString(36).substring(2, 8).toUpperCase();
  const now = Date.now();
  db.prepare('INSERT INTO schools (id, name, description, logo, inviteCode, reviewRequired, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, description || '', logo || '', code, reviewRequired ? 1 : 0, now, req.userId);
  res.json({ code: 0, data: { id, inviteCode: code } });
});

// Get school by ID
router.get('/:id', (req, res) => {
  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(req.params.id);
  if (!school) {
    return res.status(404).json({ code: 404, message: 'School not found' });
  }
  res.json({ code: 0, data: school });
});

// Join school with invite code
router.post('/:id/join', authMiddleware, (req, res) => {
  const { inviteCode } = req.body;
  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(req.params.id);
  if (!school) {
    return res.status(404).json({ code: 404, message: 'School not found' });
  }
  if (school.inviteCode !== inviteCode) {
    return res.status(400).json({ code: 400, message: 'Invalid invite code' });
  }
  const existing = db.prepare('SELECT * FROM school_members WHERE schoolId = ? AND userId = ?').get(school.id, req.userId);
  if (existing) {
    return res.status(400).json({ code: 400, message: 'Already a member' });
  }
  if (school.reviewRequired) {
    db.prepare('INSERT INTO join_requests (schoolId, userId, status, requestedAt) VALUES (?, ?, ?, ?)')
      .run(school.id, req.userId, 'pending', Date.now());
    res.json({ code: 0, message: 'Join request submitted' });
  } else {
    db.prepare('INSERT INTO school_members (schoolId, userId, role, joinedAt) VALUES (?, ?, ?, ?)')
      .run(school.id, req.userId, 'member', Date.now());
    db.prepare('UPDATE users SET schoolId = ? WHERE id = ?').run(school.id, req.userId);
    res.json({ code: 0, message: 'Joined successfully' });
  }
});

// Get school members
router.get('/:id/members', (req, res) => {
  const members = db.prepare(`
    SELECT u.id, u.nickName, u.avatarUrl, sm.role, sm.joinedAt
    FROM school_members sm
    JOIN users u ON sm.userId = u.id
    WHERE sm.schoolId = ?
    ORDER BY sm.joinedAt DESC
  `).all(req.params.id);
  res.json({ code: 0, data: members });
});

module.exports = router;
