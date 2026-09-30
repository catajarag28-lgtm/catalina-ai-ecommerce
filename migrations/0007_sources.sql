-- Fuentes de prospectos (Google Maps / OpenStreetMap / búsqueda web) y prioridad por demanda (reseñas). Solo añade.
ALTER TABLE prospect_candidates ADD COLUMN score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE prospect_candidates ADD COLUMN source TEXT NOT NULL DEFAULT '';
ALTER TABLE prospect_candidates ADD COLUMN meta TEXT;
CREATE INDEX IF NOT EXISTS idx_candidates_priority ON prospect_candidates(status,score);
