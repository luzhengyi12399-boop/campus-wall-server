const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const { authMiddleware } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ code: 0, message: 'ok', timestamp: Date.now() });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/schools', require('./routes/schools'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/items', require('./routes/items'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/groups', require('./routes/groups'));

// File upload route (simple base64 upload for now)
app.post('/api/upload', authMiddleware, (req, res) => {
  const { filename, data } = req.body; // data is base64
  if (!filename || !data) {
    return res.status(400).json({ code: 400, message: 'filename and data required' });
  }

  const uploadDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const safeName = Date.now() + '_' + filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const filePath = path.join(uploadDir, safeName);
  const buffer = Buffer.from(data, 'base64');
  fs.writeFileSync(filePath, buffer);

  res.json({ code: 0, data: { url: `/uploads/${safeName}` } });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ code: 404, message: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ code: 500, message: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Campus Wall API running on port ${PORT}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
});
