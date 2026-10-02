CREATE TABLE IF NOT EXISTS direct_applications (
  source_url TEXT PRIMARY KEY,
  platform TEXT,
  recipient TEXT,
  subject TEXT,
  body TEXT,
  route TEXT,
  status TEXT NOT NULL,
  provider_id TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  sent_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_direct_applications_status ON direct_applications(status,updated_at);
