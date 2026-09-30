# Carolina: contactos, investigación y propuestas

## Estado
Implementado y probado en esta rama. NO activado ni desplegado. La producción responde modelReady/emailReady/notifyReady=true y calendarReady=false. El CLI de Cloudflare no tiene sesión en este entorno.

La rama pública main no contiene los archivos de propuestas por sector que Claude publicó desde su PC. Integrar esos cambios antes de desplegar esta rama para no sustituir trabajo que existe solamente en producción/local.

## Flujo
- Ficha antes del chat: nombre, empresa, correo, teléfono, país; web y redes cuando existan. Consentimiento explícito para investigación, resumen y propuesta preliminar.
- Cron de 15 minutos, existente: crea una cola de prospectos cualificados del chat y explora fuentes públicas configuradas.
- PROSPECT_SOURCES es un array JSON de objetos {url}. Debe contener webs públicas de negocios o directorios pertinentes. Sin fuentes configuradas no hay descubrimiento automático.
- El descubrimiento recorre dos páginas por ejecución, obtiene correos del HTML, y exige evidencia literal de un negocio con atención en español. No usa sesiones privadas, no aplica en Workana y no salta verificaciones.
- Investigación previa, observación respaldada por una cita literal y oportunidad expresada como hipótesis. Las páginas son datos no instrucciones. Las inferencias del modelo requieren supervisión y ajuste inicial: una cita literal no demuestra por sí sola que el análisis comercial sea correcto.
- Email con marca negro/marfil/dorado, catálogo único, fases, alcance y exclusiones. CTA a propuesta web individual y Carolina. Sin resultados financieros inventados.
- Precios de implementación desde USD 2200. Mantenimiento separado. No ofrece diagnósticos de USD 490 como sustituto del proyecto.
- Máximo 5 envíos diarios entre propuestas entrantes y salientes; reserva atómica por fila y límite al reclamar. Supresión por BAJA y registro de contactos anteriores.
- Idempotencia Resend; un envío incierto no se repite automáticamente.
- Aviso a catalinajarmillo28@gmail.com. Verificar exactamente esta dirección en Cloudflare Email Routing y el binding NOTIFY antes de activar. Remitente clientes@soycatalinajaramillo.com.
- La lista persistente de contactos está en D1 outreach. No existe aún un dashboard visual ni búsqueda general con motor externo. Sin fuentes configuradas no se puede prometer búsqueda web ilimitada. No hay seguimiento comercial programado en esta versión.

## Activación (operador autenticado)
1. Integrar los cambios locales de Claude. Ejecutar npm ci, npm test, npm run build.
2. Verificar remitente en Resend y destino en Cloudflare; comprobar un aviso de prueba al correo correcto.
3. Aplicar npx wrangler d1 execute carolina-portfolio --remote --file=migrations/0002_outreach.sql.
4. Importar los contactos ya atendidos (KB Digital, Nodena, E-Luxe, Luis Victoria) como enviados para evitar repetición. Sus registros reales están en el correo, no inferir entrega desde esta rama.
5. Configurar PROSPECT_SOURCES con fuentes verificadas pertinentes para clientes hispanohablantes; empezar con una fuente y revisar investigación/propuestas iniciales.
6. Cambiar OUTREACH_ENABLED a true, desplegar npm run deploy y comprobar un envío controlado consentido. No activar antes de completar migración, prueba de correo y fuentes.
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
