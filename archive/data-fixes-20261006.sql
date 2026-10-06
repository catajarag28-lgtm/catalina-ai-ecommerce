-- Correcciones de datos de la limpieza forense del 6-oct-2026 (backup previo: CarolinaArchive-20261006/d1).
-- 1. Leads del chat de la web que fueron pruebas del 30-sep (PRUEBA TECNICA / escenario repetido de clínica).
UPDATE leads SET status='test' WHERE updated_at < 1790812800000;
-- 2. Correos de prueba (cuentas de Catalina) fuera de las métricas.
UPDATE emails SET category='test:'||coalesce(category,'') WHERE coalesce(category,'') NOT LIKE 'test:%' AND (lower(from_addr) LIKE '%catajarag%' OR lower(from_addr) LIKE '%girldo28%' OR lower(to_addr) LIKE '%girldo28%' OR lower(to_addr) LIKE '%catajarag%');
-- 3. Propuestas atascadas por errores de JSON del modelo anterior: vuelven a la cola (el router las maneja).
UPDATE outreach SET status='pending', error=NULL, updated_at=strftime('%s','now')*1000 WHERE status='review' AND id IN ('ae9bb79b-5da7-45f1-bb25-d9d160577e1e','1af1c88c-0fef-42ff-9aff-6f71d921e4c4','ad26a27a-6e03-4450-b137-dd608858d592','60263a8e-85cc-4c04-82b7-a959caf8353b');
-- 4. Oportunidades en espera humana sin fila de aplicación: ahora aparecen en la cola de Catalina.
INSERT OR IGNORE INTO direct_applications(source_url,platform,route,status,blocker,terminal,created_at,updated_at)
  SELECT url, platform, 'marketplace', 'waiting_human_submit', 'marketplace: postulación manual en la plataforma', 0, strftime('%s','now')*1000, strftime('%s','now')*1000
  FROM intent_leads i WHERE i.status LIKE 'waiting_human%' AND NOT EXISTS (SELECT 1 FROM direct_applications d WHERE d.source_url=i.url);
-- 5. Las 20 postulaciones enviadas desde el Gmail personal quedan registradas en el CRM de Carolina.
INSERT INTO emails(thread_key,direction,from_addr,to_addr,subject,body,message_id,in_reply_to,category,created_at)
  SELECT lower(recipient), 'out', 'catalinajaramillogirldo28@gmail.com', lower(recipient), 'Postulación enviada desde Gmail personal',
    'Postulación a ' || source_url || ' enviada desde el Gmail personal de Catalina el 3-oct (envío por lote). El contenido no quedó registrado en Carolina. Gmail message id: ' || provider_id || '. Las respuestas llegan a ese Gmail.',
    provider_id, NULL, 'direct_application_gmail', coalesce(sent_at, updated_at)
  FROM direct_applications d WHERE status='external_email_sent' AND recipient IS NOT NULL AND NOT EXISTS (SELECT 1 FROM emails e WHERE e.message_id=d.provider_id);
