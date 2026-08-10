PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS core_users (
  id TEXT PRIMARY KEY,
  login_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('master','admin','teacher','student')),
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
  entity_type TEXT NOT NULL CHECK (entity_type IN ('message','notice')),
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

CREATE TABLE IF NOT EXISTS core_attendance (
  attendance_date TEXT NOT NULL,
  student_id TEXT NOT NULL,
  campus TEXT NOT NULL CHECK (campus IN ('suseong1','suseong2')),
  reason TEXT NOT NULL DEFAULT '',
  p1 INTEGER NOT NULL DEFAULT 0 CHECK (p1 IN (0,1)),
  p2 INTEGER NOT NULL DEFAULT 0 CHECK (p2 IN (0,1)),
  p3 INTEGER NOT NULL DEFAULT 0 CHECK (p3 IN (0,1)),
  p4 INTEGER NOT NULL DEFAULT 0 CHECK (p4 IN (0,1)),
  p5 INTEGER NOT NULL DEFAULT 0 CHECK (p5 IN (0,1)),
  p6 INTEGER NOT NULL DEFAULT 0 CHECK (p6 IN (0,1)),
  p7 INTEGER NOT NULL DEFAULT 0 CHECK (p7 IN (0,1)),
  note TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (attendance_date,student_id),
  FOREIGN KEY (student_id) REFERENCES core_users(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES core_users(id)
);
CREATE INDEX IF NOT EXISTS idx_core_attendance_day ON core_attendance(campus,attendance_date);

CREATE TABLE IF NOT EXISTS core_counseling (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  counseling_date TEXT NOT NULL,
  purpose TEXT NOT NULL,
  counselor_id TEXT NOT NULL,
  counselee_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES core_users(id) ON DELETE CASCADE,
  FOREIGN KEY (counselor_id) REFERENCES core_users(id)
);
CREATE INDEX IF NOT EXISTS idx_core_counseling_student ON core_counseling(student_id,counseling_date);

CREATE TABLE IF NOT EXISTS core_scores (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  exam_date TEXT NOT NULL,
  exam_label TEXT NOT NULL,
  subject TEXT NOT NULL,
  raw_score REAL,
  standard_score REAL,
  percentile REAL,
  grade TEXT,
  note TEXT NOT NULL DEFAULT '',
  recorded_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES core_users(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES core_users(id)
);
CREATE INDEX IF NOT EXISTS idx_core_scores_student ON core_scores(student_id,exam_date);

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
