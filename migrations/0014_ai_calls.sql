-- Registro de costo por llamada de IA (el router también la crea si falta).
CREATE TABLE IF NOT EXISTS ai_calls (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, task TEXT NOT NULL, tier INTEGER NOT NULL, model TEXT NOT NULL, ok INTEGER NOT NULL, input_tokens INTEGER, output_tokens INTEGER, cost REAL NOT NULL DEFAULT 0, opportunity_id TEXT, outcome TEXT, latency_ms INTEGER);
CREATE INDEX IF NOT EXISTS idx_ai_calls_at ON ai_calls(at);
CREATE INDEX IF NOT EXISTS idx_ai_calls_task ON ai_calls(task,at);
