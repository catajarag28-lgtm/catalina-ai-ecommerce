# Carolina: estado actual (9-oct-2026)

Fuente única de verdad de la arquitectura. Los documentos de `docs/archive/` describen la versión anterior basada en la PC y ya no aplican.

## Dónde corre
- **Cloudflare Worker `carolina-portfolio-api`** (soycatalinajaramillo.com): crons `*/15` (ciclo completo) y `7,37` (solo envíos). D1 `carolina-portfolio`. No depende de la PC.
- **VM de Google Cloud `laura`**, solo lo de Carolina: perfil Chrome persistente `/home/cataj/carolina-cloud-runner/data/browser-profile`. Es la fuente PRIMARIA de sesiones de plataformas (Google y LinkedIn conectados). Scripts versionados en `vm/`.
- **La PC** solo sirve para administrar (acceso "CAROLINA CLOUD – CONECTAR PLATAFORMAS" en el escritorio). La tarea "Carolina Local Runner" está deshabilitada.

## Flujo
1. Descubrimiento: búsqueda de intención (Worker) y proyectos públicos de n8n. LinkedIn se revisa manualmente; su temporizador de descubrimiento en la VM está deshabilitado.
2. Cola canónica: tabla `opportunities` (`worker/prospecting/opportunities.js`). Score 0-100 sin IA, brief y propuesta única solo para A/B, quality gate y veto del brief.
3. Ejecución: el Worker verifica rutas explícitas y envía correos de postulación dentro de sus límites; la VM usa el navegador persistente para formularios aptos con un máximo de 12 intentos por ejecución y 20 al día. Las rutas bloqueadas o ambiguas pasan a revisión humana.
4. Correo: Resend desde `clientes@`/`catalina@`, buzón con asociación por dominio, freno automático por rebotes.
5. Métricas: `/health` → `ai`, `revenueMetrics`, `capacityAllocation`, `vmSessions`, `channels`, `lastCycle`.

## IA
Todas las llamadas pasan por `worker/core/modelRouter.js` (tiers gratis → DeepSeek → Gemini → Claude), con costo registrado en `ai_calls` y tope de USD 2 al día.

## Pendientes conocidos
- La cola de navegador tenía 29 oportunidades, pero ninguna era apta para envío al verificarla el 9 de octubre. El descubrimiento de n8n debe alimentar oportunidades nuevas; solo se postula cuando la ruta y el formulario pasan la verificación.
- Registrar contratos firmados y anticipos efectivamente cobrados con evidencia en `commercial_deals` mediante `POST /ops/commercial-deal`.
- Intérprete en tiempo real en producción (`/interprete`, ver `worker/interpreter/README.md`); requiere el secreto `OPENAI_API_KEY`.
- Repositorio público: hacerlo privado. Despliegue automático: renovar `CLOUDFLARE_API_TOKEN` en GitHub.

## Postulaciones verificadas (9-oct-2026)
- La VM usa Playwright sobre el perfil persistente para abrir formularios, escribir la propuesta en un campo identificado y enviar solo con ruta vigente, gratuita y completa. Si existe DISPLAY, el navegador corre visible en Xvfb.
- Preguntas de salario, disponibilidad, identidad o experiencia sin respuesta confirmada pasan a Catalina. CAPTCHA, MFA y costos siempre frenan el envío. LinkedIn queda fuera del ejecutor automático de cuenta.
- Tras el clic final, la VM guarda captura y hash en `/data/application-evidence/`; solo la confirmación visible cuenta como envío. Los clics sin confirmación se vuelven a revisar sin reenviar de inmediato.
- `POST /ops/commercial-deal` exige el token privado de Carolina Control y un `dealRef`, cliente, canal, monto firmado, fecha de firma y referencia de evidencia. El anticipo requiere monto y fecha de cobro. `/health.commercialScorecard` separa contratos firmados y anticipos cobrados en los últimos siete días.
- `capacityAllocation.expectedRevenuePerDay` es un pronóstico basado en supuestos; `forecastOnly: true` lo identifica y nunca sustituye cifras firmadas o cobradas.
