/**
 * サンプルデータ投入スクリプト
 * 実行: npx tsx scripts/seed.ts
 */
import Database from "better-sqlite3";
import bcryptjs from "bcryptjs";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "app.db");
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

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

const customers = [
  { loginId: "a-shoji", company: "A商事", propertyId: "111111111" },
  { loginId: "b-kogyo", company: "B工業", propertyId: "222222222" },
  { loginId: "c-shoten", company: "C商店", propertyId: "333333333" },
];

const insertUser = db.prepare(
  "INSERT OR IGNORE INTO users (login_id, password_hash, company_name, ga4_property_id, role) VALUES (?, ?, ?, ?, 'customer')"
);

const insertReport = db.prepare(
  `INSERT OR IGNORE INTO reports
   (user_id, week_start, week_end, sessions, pageviews, users_count, bounce_rate, avg_session_duration,
    prev_sessions, prev_pageviews, prev_users_count, prev_bounce_rate, prev_avg_session_duration)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const hash = bcryptjs.hashSync("demo1234", 12);

for (const c of customers) {
  insertUser.run(c.loginId, hash, c.company, c.propertyId);

  const user = db.prepare("SELECT id FROM users WHERE login_id = ?").get(c.loginId) as { id: number };

  const today = new Date();
  for (let w = 0; w < 4; w++) {
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() - (today.getDay() || 7) - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);

    const base = 800 + Math.floor(Math.random() * 600);
    const prevBase = 800 + Math.floor(Math.random() * 600);

    insertReport.run(
      user.id,
      weekStart.toISOString().slice(0, 10),
      weekEnd.toISOString().slice(0, 10),
      base,
      Math.floor(base * 2.5),
      Math.floor(base * 0.7),
      40 + Math.random() * 20,
      120 + Math.random() * 180,
      prevBase,
      Math.floor(prevBase * 2.5),
      Math.floor(prevBase * 0.7),
      40 + Math.random() * 20,
      120 + Math.random() * 180
    );
  }
}

console.log("サンプルデータ投入完了");
console.log("テスト顧客ログイン: a-shoji / demo1234");
db.close();
