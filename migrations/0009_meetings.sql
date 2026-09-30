-- Inteligencia de reuniones y lo que Carolina aprende de Catalina. Solo añade.
CREATE TABLE IF NOT EXISTS meeting_notes (id TEXT PRIMARY KEY, outreach_id TEXT, company TEXT, source TEXT, analysis TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS catalina_playbook (id INTEGER PRIMARY KEY AUTOINCREMENT, lesson TEXT NOT NULL UNIQUE, source_meeting TEXT, created_at INTEGER NOT NULL);
