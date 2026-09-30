CREATE TABLE IF NOT EXISTS outreach_events (
  event_id TEXT PRIMARY KEY,
  outreach_id TEXT NOT NULL,
  type TEXT NOT NULL,
  occurred_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outreach_events_type ON outreach_events(type,occurred_at);
CREATE TABLE IF NOT EXISTS outreach_control (
  id INTEGER PRIMARY KEY CHECK (id=1),
  paused INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO outreach_control(id,paused,reason,updated_at) VALUES (1,0,'',0);
ALTER TABLE outreach ADD COLUMN angle TEXT NOT NULL DEFAULT '';
