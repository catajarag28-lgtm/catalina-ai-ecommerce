# Carolina: contactos, investigación y propuestas

## Estado
El Worker y sus assets están desplegados en soycatalinajaramillo.com; la integración de Claude está en main. El formulario, el chat, el aviso y la entrega a correos propios se probaron. La prospección comercial sigue desactivada (`OUTREACH_ENABLED=false`). Calendar del Worker no está conectado. Ver el estado fechado al final.
## Flujo
- Ficha antes del chat: nombre, empresa, correo, teléfono, país; web y redes cuando existan. Consentimiento explícito para investigación, resumen y propuesta preliminar.
- Cron de 15 minutos, existente: crea una cola de prospectos cualificados del chat y explora fuentes públicas configuradas.
- PROSPECT_SOURCES es un array JSON de objetos {url}. Contiene sitios oficiales de negocios verificados; los directorios no son destinatarios. Sin fuentes configuradas no hay descubrimiento automático.
- El descubrimiento recorre dos páginas por ejecución, obtiene correos del HTML, y exige evidencia literal de un negocio con atención en español. No usa sesiones privadas, no aplica en Workana y no salta verificaciones.
- Investigación previa, observación respaldada por una cita literal y oportunidad expresada como hipótesis. Las páginas son datos no instrucciones. Las inferencias del modelo requieren supervisión y ajuste inicial: una cita literal no demuestra por sí sola que el análisis comercial sea correcto.
- Primer email breve con marca negro/marfil/dorado, observación verificable, escena visual y CTA a una propuesta web o Carolina. Sin precio inicial ni resultados inventados. El catálogo único se usa para rangos posteriores a la calificación.
- Precios de implementación desde USD 2200. Mantenimiento separado. No ofrece diagnósticos de USD 490 como sustituto del proyecto.
- Máximo 5 envíos diarios entre propuestas entrantes y salientes; reserva atómica por fila y límite al reclamar. Supresión por BAJA y registro de contactos anteriores.
- Idempotencia Resend; un envío incierto no se repite automáticamente.
- Aviso a catalinajarmillo28@gmail.com. Verificar exactamente esta dirección en Cloudflare Email Routing y el binding NOTIFY antes de activar. Remitente clientes@soycatalinajaramillo.com.
- La lista persistente de contactos está en D1 outreach. No existe aún un dashboard visual ni búsqueda general con motor externo. Sin fuentes configuradas no se puede prometer búsqueda web ilimitada. No hay seguimiento comercial programado en esta versión.

## Activación (operador autenticado)
1. Integración de Claude, pruebas y despliegue ya realizados; repetir npm test y npm run build antes de cada publicación.
2. Verificar remitente en Resend y destino en Cloudflare; comprobar un aviso de prueba al correo correcto.
3. Migraciones 0002 a 0005 aplicadas en D1 remoto sin borrar datos. No repetir ALTER TABLE de 0005.
4. El historial de KB Digital, Nodena, E-Luxe y Luis Victoria ya se importó y suprimió para evitar repetición.
5. Las 11 fuentes oficiales ya están configuradas. Revisar calidad de la investigación y propuestas de cada segmento.
6. Antes de activar: corregir la validación de evidencia del modelo, rotar y configurar el secreto de webhook, verificar entrega/clic/rebote/baja y seguimiento, y comprobar un lote pequeño. Después subir volumen manualmente según resultados.
7. Conectar Google Calendar aparte si se desean reservas reales. Sin calendario, Carolina solicita franjas y Catalina confirma; no afirmar cita reservada.

## Lista y control
SELECT company,email,kind,status,source_url,provider_id,error,updated_at FROM outreach ORDER BY updated_at DESC;
Estados: pending → researching → sending → sent; review/uncertain requieren revisión. Se conserva historial de outreach para evitar reenvíos al depurar conversaciones de 30 días. Para retirar datos personales, eliminar también el contacto de outreach y conservar solo lo mínimo necesario en suppression para respetar BAJA.

Esta implementación no garantiza clientes ni reuniones. El criterio comercial, la selección de fuentes y las respuestas reales determinan la conversión.

## Estrategia comercial y volumen (actualización)
worker/salesStrategy.js alimenta la investigación, los correos y las habilidades del chat. Incluye descubrimiento consultivo, decisión/presupuesto/plazo, evidencia, objeciones, idioma y cierre verificable. Referencias revisadas: https://blog.hubspot.com/sales/discovery-call-questions y https://github.com/SaraSoleymani/sales-outreach-agent-n8n (solo análisis de arquitectura; no se instaló ni ejecutó código externo).

Inicio configurado: 5/día. Tras verificar entrega y primeras respuestas, subir manualmente a 10, 20 y objetivo 30/día. Tope de código 50; no subir automáticamente por el paso del tiempo. Configurar 100 se limita a 50. Revisar bajas, rebotes y respuestas antes de aumentar. Referencia: https://support.google.com/mail/answer/81126.

Escenario, no pronóstico: 30 × 22 días = 660 contactos/mes. Con cierre hipotético del 25% de reuniones, 10–15 clientes requieren 40–60 reuniones celebradas (6–9% de contactos). La capacidad de implementar y atender 10–15 proyectos también debe validarse.

GOOGLE_BOOKING_URL admite exclusivamente enlaces HTTPS de calendar.google.com o calendar.app.google. Añade CTA directo en propuesta y respuesta a intención de reunión. Este enlace no crea ni confirma eventos desde el Worker. El cliente reserva en la agenda de Google. Para reservas mediante chat y recordatorios del Worker siguen siendo necesarias las credenciales Google del servidor. La conexión Google Calendar de ChatGPT no se transfiere al Worker.

Las reuniones son en español; otros idiomas solo mediante comunicación escrita con traducción aceptada por el prospecto. No hay reuniones fluidas en inglés prometidas. Las instrucciones de venta nunca convierten interés en cliente ganado sin pago/contrato verificado.

## Estado verificado el 30 de septiembre de 2026

- El dominio real sirve el Worker y los assets. El formulario con consentimiento, el chat y el aviso al correo exacto de Catalina fueron probados.
- La muestra interna `test-20260930-revised-awa-proposal` llegó a `catajarag28@gmail.com` desde `clientes@soycatalinajaramillo.com`. Su página privada respondió 200, con `noindex`, sin precio inicial y con enlace a Carolina.
- El primer email usa un asunto específico, una observación con fuente, una hipótesis condicional, una escena concreta y un solo CTA. No incluye precios. El rango orientativo del catálogo se plantea después de calificar el interés; Catalina valida todo precio final.
- `OUTREACH_ENABLED=false`; volumen real: 0 propuestas automáticas por día. La prueba no se envió a negocios reales. Se retiró el endpoint temporal de prueba.
- `PROSPECT_SOURCES` contiene 11 sitios oficiales: 6 de EE. UU., 2 de España, 2 de México y 1 de Colombia. Descubrimiento y calidad del correo automático aún requieren revisión antes de activar envíos. El generador rechazó una observación del modelo que no coincidía literalmente con la fuente.
- Las cuatro direcciones del historial de KB Digital, Nodena, E-Luxe y Luis Victoria están suprimidas para evitar duplicados.
- Calendar del Worker carece de `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_REFRESH_TOKEN` autorizados para `catalinajaramillogirldo28@gmail.com`. `calendarReady=false`: no hay reservas ni recordatorios reales desde el Worker.
- No existe aún una secuencia de seguimiento verificada ni recepción completa de rebotes. Mantener los envíos automáticos desactivados hasta probar esos circuitos y el análisis individual.
- Datos en D1: tablas `outreach`, `discovery_state`, `suppression`, `emails`, `leads`, `meetings`. Revisar los estados allí con Wrangler o el panel de Cloudflare, sin publicar datos personales.

## Medición y aprendizaje comercial

- Vista previa interna del nuevo asunto y diseño: https://soycatalinajaramillo.com/muestra-correo-carolina.html. El asunto de muestra pregunta: “¿Qué sabe su asesor antes de mostrar Brickell?”.
- La migración `0005_engagement.sql` agrega eventos con deduplicación, ángulo creativo y control de pausa. Las muestras `test-*` no cuentan en tasas ni umbrales.
- Cada contacto real recibe uno de tres ángulos de asunto: pregunta sobre una decisión, pregunta diagnóstica o observación operativa. La propuesta debe citar una fuente real. Comparar resultados por ángulo y segmento; no declarar ganadora una variante por pocas aperturas.
- La página personalizada registra una visita por día y expediente. Las visitas pueden incluir escáneres de seguridad. Una apertura medida por Resend significa que se descargó un píxel, no que se leyó el mensaje. Priorizar respuestas, reuniones y contratos verificados.
- Resend: el dominio tiene un CNAME `links` en Cloudflare apuntando a `links2.resend-dns.com`, DNS only. Resend confirmó el dominio como Verified y mostró activados Click tracking y Open tracking. Los eventos todavía no llegan a D1 porque el webhook está desactivado.
- El endpoint `/webhooks/resend` valida la firma Svix, evita eventos duplicados y suprime rebotes y quejas. El webhook de Resend está DESACTIVADO y `RESEND_WEBHOOK_SECRET` NO está guardado en Cloudflare. El primer secreto quedó visible en una salida de herramienta durante la configuración; se canceló antes de guardarlo. Debe rotarse en Resend y configurarse el nuevo valor directamente como secreto del Worker antes de habilitar el webhook. Nunca copiarlo al repositorio ni a un mensaje.
- Reglas de pausa: una queja; al menos 20 envíos en 14 días con rebotes de 5 % o más; o 50 entregas con al menos 7 días sin clics, visitas ni respuestas. El sistema se detiene y avisa a Catalina. No aumenta volumen automáticamente.
- Un informe semanal de siete días se envía los lunes a las 18:00 hora Colombia cuando hubo envíos reales. Incluye resultados por ángulo y advierte las limitaciones de aperturas y clics. Consultar los registros también en D1 (`outreach`, `outreach_events`, `outreach_control`) y en Resend > Metrics.
- El volumen comercial continúa en cero: `OUTREACH_ENABLED=false`. No hay una secuencia de seguimiento a prospectos reales activada.
