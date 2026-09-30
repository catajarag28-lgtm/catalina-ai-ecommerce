-- Publicaciones públicas donde alguien pide el servicio (prospección por intención). Solo añade.
CREATE TABLE IF NOT EXISTS intent_leads (url TEXT PRIMARY KEY, platform TEXT, who TEXT, need TEXT NOT NULL, fit TEXT, reply TEXT NOT NULL, query TEXT, found_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'new');
CREATE INDEX IF NOT EXISTS idx_intent_found ON intent_leads(found_at);
