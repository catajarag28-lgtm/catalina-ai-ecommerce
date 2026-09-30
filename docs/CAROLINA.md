# Carolina · mapa del sistema

Carolina es la agente de desarrollo comercial de Catalina Jaramillo. Encuentra empresas, las investiga, les escribe propuestas personalizadas, da seguimiento y lleva a los interesados a una reunión con Catalina. Catalina solo se reúne con prospectos calientes.

## Qué hace, en orden

| # | Etapa | Qué hace Carolina | Dónde vive |
|---|---|---|---|
| 1 | **Saber** | Todo lo que sabe (misión, posicionamiento senior, prospección, investigación, copywriting, propuestas, seguimiento, agenda, aliados, foros, aprendizaje) está en un solo registro. | `worker/skills/registry.js` → se lee en [`CAROLINA_SKILLS.md`](CAROLINA_SKILLS.md) |
| 2 | **Encontrar** | Busca negocios en Google Maps, OpenStreetMap y la web; agencias aliadas; y personas que piden el servicio en foros y Workana. | `worker/prospecting/` |
| 3 | **Verificar** | Abre la web oficial, confirma el correo publicado por el negocio, evalúa encaje y descarta duplicados, bajas y mercados excluidos. | `worker/prospecting/discovery.js` |
| 4 | **Investigar y escribir** | Diagnostica el negocio, elige el enfoque que mejor funciona, redacta, se autocritica y reescribe. | `worker/proposals/outreach.js` |
| 5 | **Mostrar** | Correo con escena visual y página inmersiva con resumen ejecutivo, demo en vivo y trayectoria de Catalina. | `worker/proposals/proposalPage.js`, `worker/proposals/demo.js` |
| 6 | **Seguir** | Seguimiento caliente a quien mostró interés, un seguimiento a los 4 días, responde correos y lleva a la agenda. | `worker/proposals/outreach.js`, `worker/core/inbox.js` |
| 7 | **Aprender** | Mide aperturas, clics, demo, respuestas y reuniones; cambia asuntos, enfoques, segmentos y volumen. | `worker/proposals/creative.js`, `worker/proposals/engagement.js` |
| 8 | **Avisar** | Te escribe cuando envía, cuando alguien muestra interés, cuando cambia algo y cada lunes con el informe. | `worker/core/notify.js` |

## Carpetas

```
worker/
├── index.js        Entrada: rutas web y ciclos automáticos (cada 15 min + envíos a los minutos 7 y 37)
├── skills/         LO QUE SABE
│   ├── registry.js         Registro único de habilidades (fuente de verdad)
│   ├── copywriting.js      Copywriting de correo, autocrítica y controles automáticos
│   ├── proposalPlaybook.js Guía de propuestas y de alianzas
│   ├── salesStrategy.js    Política comercial, volumen y agenda
│   └── chatSkills.js       Qué habilidades usa el chat según el tema
├── prospecting/    CÓMO ENCUENTRA CLIENTES
│   ├── discovery.js        Segmentos, mercados, verificación y cola
│   ├── sources.js          Google Maps y OpenStreetMap
│   └── intent.js           Personas pidiendo el servicio en foros y proyectos
├── proposals/      CÓMO PROPONE Y HACE SEGUIMIENTO
│   ├── outreach.js         Investigación, redacción, envío y seguimientos
│   ├── proposalPage.js     Diseño del correo y de la página de propuesta
│   ├── demo.js             Demo en vivo del agente de cada negocio
│   ├── creative.js         Enfoques que compiten y aprenden, y rampa de volumen
│   └── engagement.js       Métricas de Resend, pausas automáticas e informe semanal
└── core/           BASE
    ├── integrations.js     Lectura de webs, Google Calendar y envío de correo
    ├── notify.js           Avisos a Catalina
    ├── inbox.js            Respuestas a correos que llegan a clientes@
    ├── knowledge.js        Constitución y conocimiento del chat
    ├── qualification.js    Calificación de prospectos del chat
    └── emailTemplates.js   Plantillas de correo del chat
```

## Configuración clave (`wrangler.jsonc`)

- `OUTREACH_ENABLED`: prospección activa.
- `OUTREACH_DAILY_LIMIT`: techo diario (30; máximo 50). El cupo del día está en la tabla `outreach_control`.
- `NOTIFY_TO` / `CATALINA_EMAIL`: catalinajaramillogirldo28@gmail.com.
- `SENDER_POSTAL_ADDRESS`: dirección que exige la ley de EE. UU.
- `GOOGLE_BOOKING_URL`: enlace de la página de reservas de Google Calendar (pendiente).

## Dónde ver resultados

- Tu correo: avisos de propuestas, interés (🔥), foros (🎯), cambios de enfoque y el informe de los lunes.
- Base de datos D1 `carolina-portfolio`: `outreach` (propuestas), `outreach_events` (métricas), `outreach_angles` (enfoques), `prospect_candidates` (búsqueda), `intent_leads` (foros), `app_settings.last_cycle` (qué hizo el último ciclo).
- Detalle operativo y reglas: [`OUTREACH_SETUP.md`](../OUTREACH_SETUP.md).
