CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, summary TEXT NOT NULL DEFAULT '', turn_count INTEGER NOT NULL DEFAULT 0, consent INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id,id);
CREATE TABLE IF NOT EXISTS leads (conversation_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'exploring');
CREATE TABLE IF NOT EXISTS meetings (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, email TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, calendar_event_id TEXT NOT NULL, reminder_day INTEGER NOT NULL DEFAULT 0, reminder_hour INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT, name TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS emails (id INTEGER PRIMARY KEY AUTOINCREMENT, thread_key TEXT NOT NULL, direction TEXT NOT NULL, from_addr TEXT, to_addr TEXT, subject TEXT, body TEXT, message_id TEXT, in_reply_to TEXT, category TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_key,id);
CREATE TABLE IF NOT EXISTS suppression (email TEXT PRIMARY KEY, reason TEXT, created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS outreach (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, company TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'outbound', dossier TEXT, website TEXT NOT NULL, source_url TEXT NOT NULL, authorized INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', research TEXT, subject TEXT, html TEXT, provider_id TEXT, error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS discovery_state (source_url TEXT PRIMARY KEY, next_index INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
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
CREATE TABLE IF NOT EXISTS prospect_candidates (website TEXT PRIMARY KEY, company TEXT, segment TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', reason TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON prospect_candidates(status,created_at);
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
ALTER TABLE outreach ADD COLUMN sent_at INTEGER;
ALTER TABLE outreach ADD COLUMN followup_at INTEGER;
ALTER TABLE outreach ADD COLUMN segment TEXT NOT NULL DEFAULT '';
ALTER TABLE outreach_control ADD COLUMN daily_cap INTEGER NOT NULL DEFAULT 5;
UPDATE outreach SET sent_at=updated_at WHERE provider_id IS NOT NULL AND sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach(status,created_at);
CREATE INDEX IF NOT EXISTS idx_outreach_events_outreach ON outreach_events(outreach_id,type);
ALTER TABLE prospect_candidates ADD COLUMN score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE prospect_candidates ADD COLUMN source TEXT NOT NULL DEFAULT '';
ALTER TABLE prospect_candidates ADD COLUMN meta TEXT;
CREATE INDEX IF NOT EXISTS idx_candidates_priority ON prospect_candidates(status,score);
CREATE TABLE IF NOT EXISTS intent_leads (url TEXT PRIMARY KEY, platform TEXT, who TEXT, need TEXT NOT NULL, fit TEXT, reply TEXT NOT NULL, query TEXT, found_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'new');
CREATE INDEX IF NOT EXISTS idx_intent_found ON intent_leads(found_at);
