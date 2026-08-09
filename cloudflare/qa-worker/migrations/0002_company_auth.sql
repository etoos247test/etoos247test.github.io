PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS company_accounts (
  uid TEXT PRIMARY KEY,
  login_id TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  account_status TEXT NOT NULL DEFAULT 'active',
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS company_sessions (
  token_hash TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_sessions_uid ON company_sessions(uid);
CREATE INDEX IF NOT EXISTS idx_company_sessions_expiry ON company_sessions(expires_at);
