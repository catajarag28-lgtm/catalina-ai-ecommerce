# Carolina: estado actual (6-oct-2026)

Fuente única de verdad de la arquitectura. Los documentos de `docs/archive/` describen la versión anterior basada en la PC y ya no aplican.

## Dónde corre
- **Cloudflare Worker `carolina-portfolio-api`** (soycatalinajaramillo.com): crons `*/15` (ciclo completo) y `7,37` (solo envíos). D1 `carolina-portfolio`. No depende de la PC.
- **VM de Google Cloud `laura`**, solo lo de Carolina: perfil Chrome persistente `/home/cataj/carolina-cloud-runner/data/browser-profile`. Es la fuente PRIMARIA de sesiones de plataformas (Google y LinkedIn conectados). Scripts versionados en `vm/`.
- **La PC** solo sirve para administrar (acceso "CAROLINA CLOUD – CONECTAR PLATAFORMAS" en el escritorio). La tarea "Carolina Local Runner" está deshabilitada.

## Flujo
1. Descubrimiento: búsqueda de intención (Worker) + LinkedIn con la sesión persistente (`vm/linkedin-discover.mjs`).
2. Cola canónica: tabla `opportunities` (`worker/prospecting/opportunities.js`). Score 0-100 sin IA, brief y propuesta única solo para A/B, quality gate y veto del brief.
3. Ejecución: `AUTO_SUBMIT=off` (Worker) y el ejecutor de la VM forzado a `dry`. Todo queda preparado para revisión humana hasta que Catalina apruebe la calidad.
4. Correo: Resend desde `clientes@`/`catalina@`, buzón con asociación por dominio, freno automático por rebotes.
5. Métricas: `/health` → `ai`, `revenueMetrics`, `capacityAllocation`, `vmSessions`, `channels`, `lastCycle`.

## IA
Todas las llamadas pasan por `worker/core/modelRouter.js` (tiers gratis → DeepSeek → Gemini → Claude), con costo registrado en `ai_calls` y tope de USD 2 al día.

## Pendientes conocidos
- Descubrimiento de LinkedIn programado en la VM: `carolina-linkedin-discover.timer` (13:00 y 21:00 UTC). El timer de 15 min solo corre CloudSessionHealth.
- Registrar contratos ganados en la tabla `deals`.
- Intérprete en tiempo real en producción (`/interprete`, ver `worker/interpreter/README.md`); requiere el secreto `OPENAI_API_KEY`.
- Repositorio público: hacerlo privado. Despliegue automático: renovar `CLOUDFLARE_API_TOKEN` en GitHub.
