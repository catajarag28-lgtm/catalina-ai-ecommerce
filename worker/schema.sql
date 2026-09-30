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
