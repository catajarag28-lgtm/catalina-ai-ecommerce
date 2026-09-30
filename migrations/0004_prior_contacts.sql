-- Verified against sent mail in Catalina's connected Gmail on 2026-09-30.
INSERT OR IGNORE INTO suppression(email,reason,created_at) VALUES
('info@kbgroup.es','prior_contact',1790800000000),
('info@nodena.com','prior_contact',1790800000000),
('eluxeaestheticswellness@gmail.com','prior_contact',1790800000000),
('attorneyluis@luisvictorialaw.com','prior_contact',1790800000000);
INSERT INTO emails(thread_key,direction,from_addr,to_addr,subject,body,message_id,category,created_at)
SELECT 'info@kbgroup.es','out','catalinajaramillogirldo28@gmail.com','info@kbgroup.es','Freelancer Técnico IA – KB DIGITAL | Catalina Jaramillo · Automatización comercial','','gmail:1a0ef375def4e0b1','historical',1790723378000
WHERE NOT EXISTS (SELECT 1 FROM emails WHERE message_id='gmail:1a0ef375def4e0b1');
INSERT INTO emails(thread_key,direction,from_addr,to_addr,subject,body,message_id,category,created_at)
SELECT 'info@nodena.com','out','catalinajaramillogirldo28@gmail.com','info@nodena.com','Colaboración en automatización y agentes de IA — Catalina Jaramillo','','gmail:1a0ef8dd8e65adb3','historical',1790729046000
WHERE NOT EXISTS (SELECT 1 FROM emails WHERE message_id='gmail:1a0ef8dd8e65adb3');
INSERT INTO emails(thread_key,direction,from_addr,to_addr,subject,body,message_id,category,created_at)
SELECT 'eluxeaestheticswellness@gmail.com','out','catalinajaramillogirldo28@gmail.com','eluxeaestheticswellness@gmail.com','E-Luxe: propuesta de seguimiento de consultas y agenda con IA','','gmail:1a0f31dc947fb5a6','historical',1790788810000
WHERE NOT EXISTS (SELECT 1 FROM emails WHERE message_id='gmail:1a0f31dc947fb5a6');
INSERT INTO emails(thread_key,direction,from_addr,to_addr,subject,body,message_id,category,created_at)
SELECT 'attorneyluis@luisvictorialaw.com','out','catalinajaramillogirldo28@gmail.com','attorneyluis@luisvictorialaw.com','Propuesta para recepción y seguimiento administrativo de consultas — en español','','gmail:1a0f31dcb787c4ea','historical',1790788811000
WHERE NOT EXISTS (SELECT 1 FROM emails WHERE message_id='gmail:1a0f31dcb787c4ea');
