CREATE TABLE IF NOT EXISTS acquisition_actions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_id TEXT,
  external_id TEXT,
  amount_usd REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_acquisition_actions_day ON acquisition_actions(created_at,source,status);
