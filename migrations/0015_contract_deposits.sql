CREATE TABLE IF NOT EXISTS commercial_deals (
  deal_ref TEXT PRIMARY KEY,
  client TEXT NOT NULL,
  channel TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  signed_amount_usd REAL NOT NULL,
  deposit_amount_usd REAL NOT NULL DEFAULT 0,
  signed_at INTEGER NOT NULL,
  deposit_received_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_commercial_deals_signed ON commercial_deals(signed_at);
