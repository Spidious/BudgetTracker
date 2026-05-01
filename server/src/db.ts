import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), '../data/budget.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_admin    INTEGER NOT NULL DEFAULT 0,
    force_password_change INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS budget_categories (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    target_amount REAL NOT NULL DEFAULT 0,
    color        TEXT NOT NULL DEFAULT '#6366f1',
    sort_order   INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS savings_buckets (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    target_amount REAL NOT NULL DEFAULT 0,
    color        TEXT NOT NULL DEFAULT '#6366f1'
  );

  CREATE TABLE IF NOT EXISTS month_data (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_id TEXT NOT NULL,
    income   REAL NOT NULL DEFAULT 0,
    UNIQUE(user_id, month_id)
  );

  CREATE TABLE IF NOT EXISTS month_spending (
    month_data_id TEXT NOT NULL REFERENCES month_data(id) ON DELETE CASCADE,
    category_id   TEXT NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
    amount        REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (month_data_id, category_id)
  );

  CREATE TABLE IF NOT EXISTS month_savings (
    month_data_id TEXT NOT NULL REFERENCES month_data(id) ON DELETE CASCADE,
    bucket_id     TEXT NOT NULL REFERENCES savings_buckets(id) ON DELETE CASCADE,
    amount        REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (month_data_id, bucket_id)
  );

  CREATE TABLE IF NOT EXISTS shares (
    id                   TEXT PRIMARY KEY,
    owner_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_see_history      INTEGER NOT NULL DEFAULT 1,
    can_see_current_month INTEGER NOT NULL DEFAULT 1,
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(owner_id, recipient_id),
    CHECK(owner_id != recipient_id)
  );

  CREATE TABLE IF NOT EXISTS share_bucket_visibility (
    share_id   TEXT NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
    bucket_id  TEXT NOT NULL REFERENCES savings_buckets(id) ON DELETE CASCADE,
    is_visible INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (share_id, bucket_id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id                   TEXT PRIMARY KEY,
    user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_id             TEXT NOT NULL,
    date                 TEXT NOT NULL DEFAULT '',
    description          TEXT NOT NULL,
    original_description TEXT NOT NULL,
    amount               REAL NOT NULL,
    txn_type             TEXT NOT NULL DEFAULT 'expense',
    category_id          TEXT REFERENCES budget_categories(id) ON DELETE SET NULL,
    bucket_id            TEXT REFERENCES savings_buckets(id) ON DELETE SET NULL,
    sort_order           INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS category_rules (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    keyword     TEXT NOT NULL COLLATE NOCASE,
    category_id TEXT NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
    UNIQUE(user_id, keyword)
  );
`);

// Seed default admin on first run
const adminExists = db.prepare('SELECT 1 FROM users WHERE is_admin = 1').get();
if (!adminExists) {
  const tempPassword = 'Admin1234!';
  const hash = bcrypt.hashSync(tempPassword, 12);
  db.prepare(
    'INSERT INTO users (id, username, password_hash, is_admin, force_password_change) VALUES (?, ?, ?, 1, 1)'
  ).run(uuidv4(), 'admin', hash);
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  Default admin account created:          ║');
  console.log('║  Username: admin                         ║');
  console.log(`║  Password: ${tempPassword}               ║`);
  console.log('║  Change this password immediately!       ║');
  console.log('╚══════════════════════════════════════════╝\n');
}

export default db;
export { uuidv4 };
