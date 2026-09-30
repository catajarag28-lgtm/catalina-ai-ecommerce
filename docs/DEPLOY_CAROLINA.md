# Carolina: operación y conexiones pendientes

## Producción actual (30-sep-2026)

- **Sitio oficial:** https://soycatalinajaramillo.com (y `www.`). Web y API viven en el mismo Worker `carolina-portfolio-api` (assets en `dist/`). Publicar con `npm run deploy` (build + `wrangler deploy`). GitHub Pages queda como copia y usa la URL `workers.dev`, que sigue activa.
- **Precios:** fuente única en `src/offers.js` (página, `#precios`, diagnóstico guiado y conocimiento del chat). `tests/pricing.test.mjs` impide que Carolina cite precios fuera del catálogo.
- **Leads:** el diagnóstico guiado y el formulario de contacto envían a `POST /lead`; se guardan en D1 (`leads`, `conversation_id` con prefijo `web-`, status `form`) y se avisa a Catalina por email mediante Email Routing (binding `send_email` `NOTIFY`, de `carolina@soycatalinajaramillo.com` a `NOTIFY_TO`). El chat libre también avisa una vez cuando un prospecto llega a `qualified`/`high_intent`. `/health` expone `notifyReady`.
- **Correo:** `hola@soycatalinajaramillo.com` reenvía (Email Routing) a `catajaragpyg@gmail.com`. Para cambiar el destino, verificar la nueva dirección en Email Routing y actualizar `NOTIFY_TO` y `send_email.destination_address` en `wrangler.jsonc`.
- **WhatsApp:** pendiente. Al tener número, completar `CONTACT.whatsapp` en `src/offers.js`.

## Estado de la arquitectura

La web está en GitHub Pages. El backend está en `https://carolina-portfolio-api.catajaragpyg.workers.dev` y usa D1 `carolina-portfolio`. El navegador solo envía mensajes y un ID aleatorio de sesión; la clave de OpenRouter y los tokens de integraciones permanecen en Cloudflare Worker. Las conversaciones, expedientes, eventos y citas se eliminan después de 30 días. La página solicita consentimiento antes de crear una sesión.

Carolina usa OpenRouter Chat Completions con `tools`. El modelo de conversación por defecto es `google/gemini-2.5-flash-lite`, configurable en `wrangler.jsonc` como `OPENROUTER_MODEL`; la extracción usa `OPENROUTER_EXTRACT_MODEL`. El modelo `google/gemini-2.5-flash` devolvió 402 con el saldo actual de OpenRouter, por lo que se mantuvo Flash Lite en producción. El contexto se limita a los últimos 12 mensajes, un resumen rodante, el expediente y el conocimiento comercial de `worker/knowledge.js`. Los rangos de precio están configurados en ese archivo. `scripts/compare-models.mjs` permite evaluar calidad, latencia y uso de tokens con un caso idéntico, sin datos de prospectos.

Herramientas: guardar expediente y borrador interno, investigar una web pública HTTPS con autorización explícita, consultar Google Calendar, crear evento con invitación y Meet, enviar confirmación y expediente mediante Resend. Un cron cada 15 minutos envía recordatorios el día previo y aproximadamente una hora antes. El resultado de cada acción se comunica al modelo; el backend nunca confirma una cita o email por anticipado.

## OpenRouter en producción

1. La clave ya está guardada como secreto del Worker y `/health` devuelve `modelReady: true`. Como se compartió en el chat, conviene rotarla desde OpenRouter y actualizar el secreto.
2. Para rotarla, ejecutar `npx wrangler secret put OPENROUTER_API_KEY` y pegar la nueva clave en el prompt seguro. No guardarla en `.env` de GitHub Pages ni en Git.
3. Verificar `/health` y probar una conversación desde la web. Si se desea usar un modelo de mayor costo, añadir saldo o ajustar el límite en OpenRouter y cambiar `OPENROUTER_MODEL` antes de `npx wrangler deploy`.

## Activación de Google Calendar

1. En Google Cloud, habilitar Calendar API, crear un cliente OAuth de tipo aplicación web y autorizar la cuenta que administra el calendario de Catalina con acceso offline a los scopes `https://www.googleapis.com/auth/calendar.events` y `https://www.googleapis.com/auth/calendar.freebusy`. Obtener un refresh token mediante el flujo web OAuth de Google.
2. Guardar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_REFRESH_TOKEN` con `npx wrangler secret put <NOMBRE>` (una ejecución por valor).
3. Si el calendario no es `primary`, definir `GOOGLE_CALENDAR_ID` como variable del Worker. Verificar `/health`: `calendarReady` debe ser `true`.
4. Hacer una reserva de prueba, comprobar el evento en el calendario real y que el invitado reciba la invitación. La zona horaria usada para ofrecer horarios es `America/Bogota`.

## Activación de email y handoff

1. Verificar un dominio remitente en Resend y crear una API key.
2. Guardar `RESEND_API_KEY` con `npx wrangler secret put RESEND_API_KEY`.
3. Configurar `EMAIL_FROM` con un remitente verificado y `CATALINA_EMAIL` con el correo al que debe llegar el expediente. Se pueden usar variables del Worker; no son secretos si son direcciones públicas.
4. Verificar `/health`: `emailReady` debe ser `true`. Tras una reserva de prueba, comprobar confirmación, expediente a Catalina y los recordatorios programados. El expediente también queda en D1 bajo `leads`, accesible desde la cuenta Cloudflare.

## Comandos de operación

```bash
npx wrangler d1 execute carolina-portfolio --remote --file worker/schema.sql
npx wrangler deploy
npx wrangler secret list
node --test tests/*.test.mjs
npm run build
```

No probar envíos reales con contactos ajenos. Para comparar modelos, definir `OPENROUTER_API_KEY` solo en la sesión local y ejecutar `node scripts/compare-models.mjs google/gemini-2.5-flash-lite <otro-modelo>`.

## Limitaciones verificadas

Sin OpenRouter, el chat muestra explícitamente que la integración está pendiente y `/chat` devuelve 503. Sin Google OAuth, la herramienta de disponibilidad devuelve `calendar_unavailable`; no ofrece horarios inventados. Sin Resend, las confirmaciones y recordatorios por email devuelven `email_unavailable`. La invitación de Google Calendar requiere el OAuth anterior. La investigación pública depende de que la web del prospecto sea accesible y de una autorización explícita en la conversación. Los borradores de propuesta son internos y requieren revisión de Catalina.

