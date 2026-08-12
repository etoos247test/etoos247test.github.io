PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS core_master_applications (
  firebase_uid TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  note TEXT,
  FOREIGN KEY (reviewed_by) REFERENCES core_users(id)
);
CREATE INDEX IF NOT EXISTS idx_core_master_app_status ON core_master_applications(status,requested_at);
CREATE INDEX IF NOT EXISTS idx_core_master_app_email ON core_master_applications(email);

CREATE TABLE IF NOT EXISTS core_master_google_accounts (
  firebase_uid TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  linked_at TEXT NOT NULL,
  linked_by TEXT,
  FOREIGN KEY (user_id) REFERENCES core_users(id) ON DELETE CASCADE,
  FOREIGN KEY (linked_by) REFERENCES core_users(id)
);
CREATE INDEX IF NOT EXISTS idx_core_master_google_user ON core_master_google_accounts(user_id);
