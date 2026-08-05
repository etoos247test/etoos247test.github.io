PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'pending'
    CHECK (role IN ('pending','student','teacher','master')),
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  campus TEXT CHECK (campus IS NULL OR campus IN ('suseong1','suseong2')),
  student_id TEXT UNIQUE,
  can_answer_questions INTEGER NOT NULL DEFAULT 0 CHECK (can_answer_questions IN (0,1)),
  can_approve_students INTEGER NOT NULL DEFAULT 0 CHECK (can_approve_students IN (0,1)),
  can_manage_student_info INTEGER NOT NULL DEFAULT 0 CHECK (can_manage_student_info IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teacher_campuses (
  teacher_uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  campus TEXT NOT NULL CHECK (campus IN ('suseong1','suseong2')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (teacher_uid, campus)
);

CREATE TABLE IF NOT EXISTS student_applications (
  uid TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  campus TEXT NOT NULL CHECK (campus IN ('suseong1','suseong2')),
  contact_last4 TEXT NOT NULL CHECK (length(contact_last4) = 4),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  assigned_student_id TEXT,
  requested_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES users(uid),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teacher_requests (
  uid TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  requested_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES users(uid),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  student_uid TEXT NOT NULL REFERENCES users(uid),
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  campus TEXT NOT NULL CHECK (campus IN ('suseong1','suseong2')),
  subject TEXT NOT NULL CHECK (subject IN ('국어','수학','영어','사탐','과탐','입시')),
  status TEXT NOT NULL DEFAULT 'waiting_teacher'
    CHECK (status IN ('waiting_teacher','waiting_student','closed')),
  last_message_at TEXT NOT NULL,
  last_message_role TEXT NOT NULL CHECK (last_message_role IN ('student','teacher','master')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  closed_by TEXT REFERENCES users(uid)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  author_uid TEXT NOT NULL REFERENCES users(uid),
  author_role TEXT NOT NULL CHECK (author_role IN ('student','teacher','master')),
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  edited_at TEXT
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  uploader_uid TEXT NOT NULL REFERENCES users(uid),
  uploader_role TEXT NOT NULL CHECK (uploader_role IN ('student','teacher','master')),
  object_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 1048576),
  width INTEGER,
  height INTEGER,
  sha256 TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_uid TEXT REFERENCES users(uid),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  campus TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active);
CREATE INDEX IF NOT EXISTS idx_users_campus_student_id ON users(campus, student_id);
CREATE INDEX IF NOT EXISTS idx_applications_status_campus ON student_applications(status, campus, requested_at);
CREATE INDEX IF NOT EXISTS idx_questions_student_time ON questions(student_uid, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_campus_status_time ON questions(campus, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_subject_status ON questions(subject, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_question_time ON messages(question_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_attachments_object_key ON attachments(object_key);
CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(created_at DESC);
