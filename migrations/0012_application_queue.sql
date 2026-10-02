-- Durable retry/audit queue for contract applications.
ALTER TABLE direct_applications ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE direct_applications ADD COLUMN last_attempt_at INTEGER;
ALTER TABLE direct_applications ADD COLUMN next_attempt_at INTEGER;
ALTER TABLE direct_applications ADD COLUMN blocker TEXT;
ALTER TABLE direct_applications ADD COLUMN terminal INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_direct_applications_due ON direct_applications(terminal,next_attempt_at,status,updated_at);
