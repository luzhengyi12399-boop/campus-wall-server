module.exports = {
  PORT: process.env.PORT || 3000,
  DB_PATH: process.env.DB_PATH || './data/campus_wall.db',
  JWT_SECRET: process.env.JWT_SECRET || 'campus-wall-api-secret-2024-secure-key',
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  WX_APPID: process.env.WX_APPID || '',
  WX_SECRET: process.env.WX_SECRET || '',
  PAGE_SIZE: 20
};
