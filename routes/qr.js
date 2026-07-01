const express = require('express');
const QRCode = require('qrcode');
const db = require('../database');
const { optionalAuth } = require('../auth');

const router = express.Router();

// Generate QR code image
// GET /api/qr/generate?content=xxx&size=300
router.get('/generate', (req, res) => {
  const { content, size = 300 } = req.query;
  if (!content) {
    return res.status(400).json({ code: 400, message: 'content required' });
  }

  QRCode.toBuffer(content, {
    width: parseInt(size) || 300,
    type: 'png',
    margin: 2,
    errorCorrectionLevel: 'M'
  })
    .then(buffer => {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(buffer);
    })
    .catch(err => {
      console.error('QR generate error:', err);
      res.status(500).json({ code: 500, message: err.message });
    });
});

// Decode QR content (called after wx.scanCode reads a QR code)
// POST /api/qr/scan
router.post('/scan', optionalAuth, (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ code: 400, message: 'content required' });
  }

  // Parse format: person:xxx or school:xxx
  const parts = content.split(':');
  if (parts.length < 2) {
    return res.status(400).json({ code: 400, message: 'Invalid QR code format' });
  }

  const type = parts[0];
  const id = parts[1];

  if (type === 'person') {
    const user = db.prepare('SELECT id, nickName, avatarUrl, bio, schoolId, creditScore FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ code: 404, message: 'User not found' });
    }
    res.json({
      code: 0,
      data: {
        type: 'person',
        user: {
          id: user.id,
          nickName: user.nickName,
          avatarUrl: user.avatarUrl || '',
          bio: user.bio || '',
          schoolId: user.schoolId || '',
          creditScore: user.creditScore || 100
        }
      }
    });
  } else if (type === 'school') {
    const school = db.prepare('SELECT id, name, description, logo FROM schools WHERE id = ?').get(id);
    if (!school) {
      return res.status(404).json({ code: 404, message: 'School not found' });
    }
    res.json({
      code: 0,
      data: {
        type: 'school',
        school: {
          id: school.id,
          name: school.name,
          description: school.description || '',
          logo: school.logo || ''
        }
      }
    });
  } else {
    res.status(400).json({ code: 400, message: 'Unknown QR code type' });
  }
});

module.exports = router;
