-- Motor creativo, descubrimiento por búsqueda y rampa de volumen. Solo añade; no borra datos.
CREATE TABLE IF NOT EXISTS outreach_angles (id TEXT PRIMARY KEY, name TEXT NOT NULL, format TEXT NOT NULL DEFAULT 'visual', brief TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', generation INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, retired_at INTEGER, retired_reason TEXT);
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
