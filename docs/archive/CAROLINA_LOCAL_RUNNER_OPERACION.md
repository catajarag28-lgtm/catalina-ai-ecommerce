# Carolina Local Runner — Operación real

Este runner existe para plataformas que bloquean navegadores cloud/remotos: LinkedIn, Upwork, Workana, n8n, Make, Contra, Wellfound, Twine, Guru, Malt y PeoplePerHour.

## Principios

- No guarda contraseñas.
- No imprime ni exporta cookies.
- No evade CAPTCHA/MFA.
- Usa perfiles locales dedicados de Chrome en el PC de Catalina.
- Si hay costo, Connects, CAPTCHA, MFA o pregunta sensible, marca `WAITING_HUMAN`.
- Todo debe registrar evidencia en el journal local y en el CRM.

CRM central:
https://docs.google.com/spreadsheets/d/1lo_DiuxlymTTqu42OPau_MNaYWE751cA_lATGUne0t8/edit

## Comandos

Desde el repo:

```bash
npm run carolina:audit
npm run carolina:connect
npm run carolina:runner
npm run carolina:report
```

Equivalentes:

```bash
node scripts/runner-local.js audit
node scripts/runner-local.js connect-all
node scripts/runner-local.js run
node scripts/carolina-daily-report.js
```

## Variables necesarias

Para auditar Cloud:

```bash
CAROLINA_BASE_URL=https://soycatalinajaramillo.com
BROWSER_ADMIN_TOKEN=<token admin del worker>
```

Para reporte WhatsApp 2Chat:

```bash
TWOCHAT_API_KEY=<api key de 2Chat>
TWOCHAT_FROM_NUMBER=<numero conectado en 2Chat>
CATALINA_WHATSAPP_TO=<numero de Catalina>
```

## Primer arranque

1. Ejecutar:

```bash
npm run carolina:connect
```

2. Completar login humano una vez en cada plataforma que se abra.

3. No cerrar los perfiles dedicados hasta que se confirme login.

4. Ejecutar:

```bash
npm run carolina:audit
npm run carolina:runner
```

## Tarea programada Windows

Cuando el PC esté online y el repo actualizado, crear una tarea de Windows que ejecute cada 15 minutos:

```powershell
cd $HOME\catalina-ai-ecommerce
npm run carolina:runner
```

Y otra a las 7:00 pm:

```powershell
cd $HOME\catalina-ai-ecommerce
npm run carolina:report
```

## Qué cuenta como éxito

No cuenta como éxito “abrió navegador”. Solo cuenta si existe evidencia:

- URL de oportunidad.
- Timestamp.
- Plataforma.
- Propuesta enviada/resumen.
- Confirmación visible o provider/message id.
- Estado final: `POSTULADA`, `ENVIADA`, `RESPONDIÓ`, `CITA`, `WAITING_HUMAN`, `DESCARTADA`.

## Límites de seguridad

- Upwork: no gastar Connects sin límite explícito de Catalina.
- Freelancer: no gastar bids/upgrade sin límite explícito.
- LinkedIn: no enviar mensajes masivos ni acciones que parezcan spam.
- Comunidades n8n/Make: responder con valor, no publicar spam.
