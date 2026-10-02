-- Persist the evidence that makes an intent lead an auditable contract/opportunity.
-- Existing rows default to unknown/not-proven; only newly verified scans set explicit_demand=1.
ALTER TABLE intent_leads ADD COLUMN explicit_demand INTEGER NOT NULL DEFAULT 0;
ALTER TABLE intent_leads ADD COLUMN active_now INTEGER;
ALTER TABLE intent_leads ADD COLUMN application_route TEXT;
ALTER TABLE intent_leads ADD COLUMN evidence TEXT;
