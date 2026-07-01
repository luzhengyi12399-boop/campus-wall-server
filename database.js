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
      bio TEXT,
      gender TEXT,
      grade TEXT,
      creditScore REAL DEFAULT 100,
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

  // Items (market) table
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      schoolId TEXT,
      title TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      originalPrice REAL,
      images TEXT,
      category TEXT,
      tags TEXT,
      condition TEXT,
      status TEXT DEFAULT 'selling',
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
      status TEXT DEFAULT 'open',
      channel TEXT DEFAULT 'school',
      images TEXT,
      acceptedBy TEXT,
      acceptedAt INTEGER,
      submittedAt INTEGER,
      completedAt INTEGER,
      startTime INTEGER,
      endTime INTEGER,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Orders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      itemId TEXT NOT NULL,
      buyerId TEXT NOT NULL,
      sellerId TEXT NOT NULL,
      price REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      address TEXT,
      shippedAt INTEGER,
      completedAt INTEGER,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatId TEXT NOT NULL,
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
      data TEXT,
      read INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Friend requests table
  db.exec(`
    CREATE TABLE IF NOT EXISTS friend_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromUserId TEXT NOT NULL,
      toUserId TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(fromUserId, toUserId)
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
      balanceAfter REAL NOT NULL,
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
      targetId TEXT NOT NULL,
      targetType TEXT NOT NULL,
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
      avatar TEXT,
      createdBy TEXT NOT NULL,
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
      chatId TEXT NOT NULL UNIQUE,
      type TEXT DEFAULT 'private',
      lastMessage TEXT,
      lastMessageAt INTEGER,
      unreadCount INTEGER DEFAULT 0,
      participantIds TEXT
    )
  `);

  // Create indexes
  db.exec('CREATE INDEX IF NOT EXISTS idx_posts_schoolId ON posts(schoolId)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_posts_userId ON posts(userId)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_items_userId ON items(userId)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_items_schoolId ON items(schoolId)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_userId ON tasks(userId)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_buyerId ON orders(buyerId)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_sellerId ON orders(sellerId)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_chatId ON messages(chatId)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_wallet_history_userId ON wallet_history(userId)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_friends_userId1 ON friends(userId1)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_friends_userId2 ON friends(userId2)');

  console.log('Database initialized successfully');
}

initDatabase();

module.exports = db;
