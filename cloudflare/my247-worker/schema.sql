PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS core_users (
  id TEXT PRIMARY KEY,
  login_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('master','teacher','student')),
  campus TEXT CHECK (campus IN ('suseong1','suseong2') OR campus IS NULL),
  student_no TEXT UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0,1)),
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_core_users_role ON core_users(role,active);
CREATE INDEX IF NOT EXISTS idx_core_users_campus ON core_users(campus,role,active);

CREATE TABLE IF NOT EXISTS core_user_campuses (
  user_id TEXT NOT NULL,
  campus TEXT NOT NULL CHECK (campus IN ('suseong1','suseong2')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id,campus),
  FOREIGN KEY (user_id) REFERENCES core_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS core_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES core_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_core_sessions_user ON core_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_core_sessions_expiry ON core_sessions(expires_at);

CREATE TABLE IF NOT EXISTS core_notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  campus TEXT CHECK (campus IN ('suseong1','suseong2') OR campus IS NULL),
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','student','staff')),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0,1)),
  author_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (author_id) REFERENCES core_users(id)
);
CREATE INDEX IF NOT EXISTS idx_core_notices_sort ON core_notices(visible,pinned,created_at);

CREATE TABLE IF NOT EXISTS core_exam_schedules (
  id TEXT PRIMARY KEY,
  exam_date TEXT NOT NULL,
  period_label TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  campus TEXT CHECK (campus IN ('suseong1','suseong2') OR campus IS NULL),
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0,1)),
  author_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (author_id) REFERENCES core_users(id)
);
CREATE INDEX IF NOT EXISTS idx_core_schedule_date ON core_exam_schedules(exam_date,visible);

CREATE TABLE IF NOT EXISTS core_questions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  campus TEXT NOT NULL CHECK (campus IN ('suseong1','suseong2')),
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES core_users(id)
);
CREATE INDEX IF NOT EXISTS idx_core_questions_student ON core_questions(student_id,created_at);
CREATE INDEX IF NOT EXISTS idx_core_questions_staff ON core_questions(campus,status,updated_at);

CREATE TABLE IF NOT EXISTS core_messages (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (question_id) REFERENCES core_questions(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES core_users(id)
);
CREATE INDEX IF NOT EXISTS idx_core_messages_question ON core_messages(question_id,created_at);

CREATE TABLE IF NOT EXISTS core_attachments (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('message')),
  entity_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploader_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (uploader_id) REFERENCES core_users(id)
);
CREATE INDEX IF NOT EXISTS idx_core_attachments_entity ON core_attachments(entity_type,entity_id);

CREATE TABLE IF NOT EXISTS core_audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_key TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (actor_id) REFERENCES core_users(id)
);
CREATE INDEX IF NOT EXISTS idx_core_audit_created ON core_audit_logs(created_at);

-- RBAC extension: keep the legacy core_users.role values unchanged for compatibility.
-- A 준마스터 is stored as role='teacher' plus account_type='submaster'.
CREATE TABLE IF NOT EXISTS core_user_profiles (
  user_id TEXT PRIMARY KEY,
  account_type TEXT NOT NULL CHECK (account_type IN ('student','teacher','submaster')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES core_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_core_user_profiles_type ON core_user_profiles(account_type);

CREATE TABLE IF NOT EXISTS core_user_permissions (
  user_id TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 1 CHECK (allowed IN (0,1)),
  granted_by TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id,permission_key),
  FOREIGN KEY (user_id) REFERENCES core_users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES core_users(id)
);
CREATE INDEX IF NOT EXISTS idx_core_user_permissions_key ON core_user_permissions(permission_key,allowed);
