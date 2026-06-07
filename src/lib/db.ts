import Database from "better-sqlite3";
import path from "path";
import bcryptjs from "bcryptjs";

const DB_PATH = path.join(process.cwd(), "data", "app.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login_id TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      company_name TEXT NOT NULL,
      ga4_property_id TEXT,
      role TEXT NOT NULL DEFAULT 'customer',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      sessions INTEGER DEFAULT 0,
      pageviews INTEGER DEFAULT 0,
      users_count INTEGER DEFAULT 0,
      bounce_rate REAL DEFAULT 0,
      avg_session_duration REAL DEFAULT 0,
      prev_sessions INTEGER DEFAULT 0,
      prev_pageviews INTEGER DEFAULT 0,
      prev_users_count INTEGER DEFAULT 0,
      prev_bounce_rate REAL DEFAULT 0,
      prev_avg_session_duration REAL DEFAULT 0,
      new_users INTEGER DEFAULT 0,
      returning_users INTEGER DEFAULT 0,
      prev_new_users INTEGER DEFAULT 0,
      prev_returning_users INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, week_start)
    );

    CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      login_id TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      success INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // マイグレーション: 新規/リピーターカラム追加
  try {
    db.exec("ALTER TABLE reports ADD COLUMN new_users INTEGER DEFAULT 0");
    db.exec("ALTER TABLE reports ADD COLUMN returning_users INTEGER DEFAULT 0");
    db.exec("ALTER TABLE reports ADD COLUMN prev_new_users INTEGER DEFAULT 0");
    db.exec("ALTER TABLE reports ADD COLUMN prev_returning_users INTEGER DEFAULT 0");
  } catch {
    // カラムが既に存在する場合はスキップ
  }

  const admin = db
    .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    .get();
  if (!admin) {
    const hash = bcryptjs.hashSync("admin123change", 12);
    db.prepare(
      "INSERT INTO users (login_id, password_hash, company_name, role) VALUES (?, ?, ?, ?)"
    ).run("admin", hash, "管理者", "admin");
  }
}
