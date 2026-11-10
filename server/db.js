const Database = require('better-sqlite3');
const path = require('path');
const logger = require('./logger');
const dbPath = path.join(__dirname, '..', 'videos.db');
const db = new Database(dbPath, { timeout: 5000 });
try {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('cache_size = 20000');

  db.pragma('optimize');
  console.log('Database optimization executed.');
} catch (e) {
  logger.error('Database pragma warning', e);
}

db.function('seeded_random', { deterministic: true }, (seed, id) => {
  // A simple hash function to generate a stable pseudo-random value
  // based on seed and id.
  let h = (seed ^ id) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
});

db.function('normalize', (text) => {
  if (typeof text !== 'string') return text;
  // NFKC: Normalizes half-width/full-width, etc.
  let normalized = text.normalize('NFKC');
  // Katakana to Hiragana conversion
  return normalized.replace(/[\u30a1-\u30f6]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
});

// --- Schema Initialization ---
function initDb(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
        hash TEXT PRIMARY KEY,
        duration REAL,
        thumbnail BLOB,
        play_count INTEGER DEFAULT 0,
        tags TEXT COLLATE NOCASE,
        use_transcode INTEGER,
        last_played_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        display_name TEXT COLLATE NOCASE,
        last_pos REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE COLLATE NOCASE,
        filename TEXT COLLATE NOCASE,
        size INTEGER,
        hash TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (hash) REFERENCES metadata(hash)
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );

    CREATE TABLE IF NOT EXISTS screenshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT,
        timestamp REAL,
        image_data BLOB,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (hash) REFERENCES metadata(hash)
    );

    CREATE TEMP TABLE IF NOT EXISTS imagelist (
        hash TEXT,
        position REAL,
        image_data BLOB,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (hash, position)
    );
`);

  // Initialize default settings if they don't exist
  try {
    const checkSettings = database.prepare("SELECT count(*) as count FROM settings WHERE key = ?");

    const defaultExtensions = [".mp4", ".avi", ".wmv", ".mov", ".flv", ".mpg", ".mpeg", ".vob", ".asf", ".mkv", ".ts", ".m2ts", ".webm", ".rm", ".rmvb"];
    if (checkSettings.get('video_extensions').count === 0) {
      database.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('video_extensions', JSON.stringify(defaultExtensions));
    }

    if (checkSettings.get('ignore_patterns').count === 0) {
      database.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('ignore_patterns', JSON.stringify([]));
    }

    if (checkSettings.get('preset_tags').count === 0) {
      const defaultTags = ["予約", "Good", "お気に入り"];
      database.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('preset_tags', JSON.stringify(defaultTags));
    }

    if (checkSettings.get('allow_public').count === 0) {
      database.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('allow_public', JSON.stringify(false));
    }

  } catch (e) {
    // Only log if it's not a missing table error during initial check
    if (!e.message.includes('no such table')) {
      logger.error('データベース初期化エラー', e);
    }
  }
}

// Initialize the default DB instance
initDb(db);

module.exports = db;
module.exports.initDb = initDb;
