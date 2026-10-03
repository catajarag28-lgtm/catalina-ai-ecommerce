-- Persist source language so every application uses the matching proposal/CV/profile.
ALTER TABLE intent_leads ADD COLUMN language TEXT;
CREATE INDEX IF NOT EXISTS idx_intent_language ON intent_leads(language,status,found_at);
