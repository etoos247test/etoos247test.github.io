PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS core_applications (
  id TEXT PRIMARY KEY,
  receipt_no TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'general-qr',
  applicant_type TEXT NOT NULL DEFAULT 'student' CHECK (applicant_type IN ('student','guardian')),
  student_name TEXT NOT NULL,
  school TEXT NOT NULL DEFAULT '',
  grade TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  guardian_phone TEXT NOT NULL DEFAULT '',
  campus TEXT NOT NULL DEFAULT 'undecided' CHECK (campus IN ('suseong1','suseong2','undecided')),
  program TEXT NOT NULL,
  subjects_json TEXT NOT NULL DEFAULT '[]',
  preferred_date TEXT NOT NULL DEFAULT '',
  inquiry TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','reserved','counseled','registered','closed')),
  assigned_to TEXT,
  appointment_at TEXT NOT NULL DEFAULT '',
  counsel_note TEXT NOT NULL DEFAULT '',
  student_user_id TEXT,
  privacy_agreed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (assigned_to) REFERENCES core_users(id),
  FOREIGN KEY (student_user_id) REFERENCES core_users(id)
);

CREATE INDEX IF NOT EXISTS idx_core_applications_status ON core_applications(status,created_at);
CREATE INDEX IF NOT EXISTS idx_core_applications_campus ON core_applications(campus,status,created_at);
CREATE INDEX IF NOT EXISTS idx_core_applications_assigned ON core_applications(assigned_to,status,created_at);
CREATE INDEX IF NOT EXISTS idx_core_applications_phone ON core_applications(phone,created_at);
