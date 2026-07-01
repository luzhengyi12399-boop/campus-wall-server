require('dotenv').config();

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'campus_wall.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      openid TEXT UNIQUE,
      unionid TEXT,
      nickName TEXT,
      avatarUrl TEXT,
      phone TEXT,
      password TEXT,
      twoFASecret TEXT,
      twoFAEnabled INTEGER DEFAULT 0,
      wallet REAL DEFAULT 0,
      schoolId TEXT,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Schools table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      logo TEXT,
      verified INTEGER DEFAULT 0,
      inviteCode TEXT UNIQUE,
      reviewRequired INTEGER DEFAULT 1,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      createdBy TEXT
    )
  `);

  // School members table
  db.exec(`
    CREATE TABLE IF NOT EXISTS school_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schoolId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      joinedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(schoolId, userId)
    )
  `);

  // Join requests table
  db.exec(`
    CREATE TABLE IF NOT EXISTS join_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schoolId TEXT NOT NULL,
      userId TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      requestedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(schoolId, userId)
    )
  `);

  // Posts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      schoolId TEXT,
      userId TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      content TEXT NOT NULL,
      images TEXT,
      status TEXT DEFAULT 'approved',
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Post likes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      postId TEXT NOT NULL,
      userId TEXT NOT NULL,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(postId, userId)
    )
  `);

  // Comments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      postId TEXT NOT NULL,
      userId TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Items table (marketplace)
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      schoolId TEXT,
      title TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category TEXT,
      images TEXT,
      status TEXT DEFAULT 'available',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      schoolId TEXT,
      title TEXT NOT NULL,
      description TEXT,
      reward REAL NOT NULL,
      category TEXT,
      status TEXT DEFAULT 'open',
      assigneeId TEXT,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      completedAt INTEGER
    )
  `);

  // Orders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyerId TEXT NOT NULL,
      sellerId TEXT NOT NULL,
      itemId TEXT,
      taskId TEXT,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      senderId TEXT NOT NULL,
      receiverId TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      read INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      relatedId TEXT,
      read INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Friend requests table
  db.exec(`
    CREATE TABLE IF NOT EXISTS friend_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senderId TEXT NOT NULL,
      receiverId TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(senderId, receiverId)
    )
  `);

  // Friends table
  db.exec(`
    CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId1 TEXT NOT NULL,
      userId2 TEXT NOT NULL,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(userId1, userId2)
    )
  `);

  // Wallet history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance REAL NOT NULL,
      description TEXT,
      relatedId TEXT,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Reports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporterId TEXT NOT NULL,
      targetType TEXT NOT NULL,
      targetId TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Groups table
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      avatar TEXT,
      creatorId TEXT NOT NULL,
      schoolId TEXT,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Group members table
  db.exec(`
    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      groupId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      joinedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(groupId, userId)
    )
  `);

  // Chat sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId1 TEXT NOT NULL,
      userId2 TEXT NOT NULL,
      lastMessageId TEXT,
      lastMessageAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      unread1 INTEGER DEFAULT 0,
      unread2 INTEGER DEFAULT 0,
      UNIQUE(userId1, userId2)
    )
  `);

  // Create indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_school ON users(schoolId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_posts_school ON posts(schoolId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(userId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_items_user ON items(userId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_items_school ON items(schoolId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(userId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_school ON tasks(schoolId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyerId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(sellerId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(senderId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiverId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_history(userId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_friends_u1 ON friends(userId1)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_friends_u2 ON friends(userId2)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_school_members ON school_members(schoolId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_group_members ON group_members(groupId)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_sessions ON chat_sessions(userId1, userId2)`);
}

initDatabase();

module.exports = db;
