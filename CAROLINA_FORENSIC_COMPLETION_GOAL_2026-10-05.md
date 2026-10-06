# CAROLINA — FORENSIC COMPLETION GOAL — 2026-10-05

## MANDATO
No entregues otro plan ni otro resumen de capacidades. Parte del estado REAL de producción indicado aquí, compruébalo contra D1/logs/código, implementa los arreglos, prueba E2E y despliega.

Carolina es un Revenue OS. Debe conseguir conversaciones, citas calificadas y clientes combinando:
1. outbound directo a empresas/CEO;
2. postulaciones a vacantes/proyectos con intención explícita;
3. marketplaces por API oficial cuando exista;
4. intent leads públicos;
5. partners/white-label;
6. ABM/dream accounts;
7. follow-up;
8. inbound y referidos.

Objetivo comercial NORTH STAR:
- 10 citas CALIFICADAS por día como meta de sistema maduro, no métrica ficticia.
- 5 clientes pagos por semana como objetivo operativo inmediato; 30/mes como norte si el funnel lo soporta.
- Nunca sacrificar reputación, cumplimiento ni calidad por volumen.
- Medir SENT/SUBMITTED solo con evidencia real.

## HALLAZGOS FORENSES VERIFICADOS EN PRODUCCIÓN
Base canónica: Cloudflare D1 carolina-portfolio.
Repo: C:\Users\cataj\catalina-ai-ecommerce, main.

Al auditar producción hoy:
- outreach outbound: 133 registros totales;
- 24 sent;
- 1 replied;
- 5 bounced;
- 60 pending;
- partners enviados: 0;
- direct applications con provider_id: 21 históricas, 0 hoy;
- marketplace submissions reales: 4 históricas, 0 hoy;
- meetings: 0 total;
- hoy hubo 10 email.sent, 9 delivered, 1 bounced y 16 followup.sent;
- bounce rate 7d: ~20.8%, peligrosamente alto;
- outreach_control está PAUSED por entregabilidad.
## PROBLEMA 1 — LAS POSTULACIONES NO SE ESTÁN EJECUTANDO
scripts/safe-auto-apply.js NO envía. Solo marca READY_FOR_BROWSER_SUBMIT y deja handoff.
La frase del propio código confirma que el click real depende del motor local del PC.
Eso NO cumple cloud-first ni autonomía.

Implementa un Submission Executor cloud real para rutas permitidas:
- emails de aplicación explícitos y verificados;
- formularios públicos de ATS (Lever/Greenhouse/Ashby/Workable u otros compatibles) cuando sea técnicamente seguro;
- APIs oficiales de marketplaces;
- comunidades donde exista publicación/reply permitida y sesión autorizada.

LinkedIn/Workana/Upwork:
- NO evadir CAPTCHA/MFA ni protecciones;
- NO automatizar agresivamente LinkedIn;
- usar browser session autorizada solo dentro de límites seguros y términos aplicables;
- si el submit requiere interacción humana real, dejar READY_TO_SUBMIT con todo precargado y SLA <2h.
Un bloqueo en un canal no puede detener los demás.

## PROBLEMA 2 — SESIONES CLOUD NO ESTÁN LISTAS
Estado real auditado:
- google = setup_waiting_human, savedAt null;
- linkedin = setup_waiting_human, savedAt null;
- upwork = setup_waiting_human;
- workana = expired;
- n8n = expired;
- make = expired.

No digas “sesión conectada” si no existe storageState cifrado + probe exitoso.
Genera flujo de setup/refresco para cada plataforma necesaria.
Después de login manual único, guardar storageState cifrado en BROWSER_SESSIONS.
Agregar health/probe diario, expiry detection y alerta accionable.
Probar reinicio y PC apagado.

## PROBLEMA 3 — GOOGLE SHEET CRM ESTÁ DESINCRONIZADO
Sheet canónico:
1lo_DiuxlymTTqu42OPau_MNaYWE751cA_lATGUne0t8
Título: CAROLINA CRM — Postulaciones, propuestas y métricas.

El Dashboard muestra solo 3 oportunidades/3 enviadas/0 citas y la pestaña Postulaciones tiene solo 3 filas del 3-oct.
Eso contradice D1 y demuestra que hoy NO existe un sync real.
El código solo enlaza la hoja; no la mantiene.

Implementa D1 -> Google Sheets sync durable y automático.
D1 es source of truth; Sheet es vista operativa/auditable.
Sincronizar como mínimo:
- todas las oportunidades;
- canal/plataforma;
- empresa/contacto/país/idioma;
- tipo: outbound/application/marketplace/partner/intent/ABM;
- found/qualified/prepared/submitted/sent/delivered/replied/positive/meeting/proposal/won/lost;
- provider_id/message_id/bid_id;
- segmento, ángulo, copy_version, offer_version;
- costo de IA;
- revenue potential y revenue won;
- next_action/followup;
- blocker;
- timestamps.
## PROBLEMA 4 — NO HAY CIERRE DIARIO ÚTIL
Cada día, hora Colombia configurable, producir y enviar un cierre ejecutivo y escribirlo en Sheet:
- FOUND;
- QUALIFIED;
- CONTACTED/SENT;
- SUBMITTED real;
- delivered;
- bounce;
- human replies;
- positive replies;
- meetings booked;
- meetings held;
- proposals económicas;
- WON;
- revenue;
- gasto IA;
- por canal, país, vertical, segmento, ángulo y copy_version;
- top 5 oportunidades;
- bloqueos;
- qué estrategia se mantiene;
- qué se pausa;
- qué experimento cambia mañana y POR QUÉ.

No usar aperturas como KPI principal: pueden estar infladas por privacidad/scanners.
Clicks son diagnóstico, no resultado.
Priorizar human reply -> positive reply -> meeting -> won.

## PROBLEMA 5 — META Y CAPACIDAD MAL TRADUCIDAS
La Constitución actual limita outbound a 30 nuevos/día y el Revenue Plan apunta a ~70 acciones totales.
Eso no puede producir 10 citas/día de manera consistente.

Diseña una capacidad MULTICANAL escalable, no 500 correos desde el dominio principal.
Usa:
- postulaciones explícitas;
- intent;
- partner/white-label;
- ABM;
- LinkedIn signal-based con aprobación humana cuando corresponda;
- email directo validado;
- warm/reactivation;
- communities;
- inbound/referrals.

Meta de capacidad MADURA: 200–500 qualified commercial actions/day según tasa real de meeting booking.
No escalar hasta tener seguridad por canal.
El throughput debe calcularse automáticamente:
required_actions = target_meetings / trailing_14d_meeting_rate
con floor/ceiling por canal y controles de seguridad.

Si meeting_rate global < objetivo:
1. diagnosticar deliverability;
2. intent/fit;
3. copy/offer;
4. CTA;
5. channel mix;
6. follow-up;
y cambiar UNA variable por experimento.

## PROBLEMA 6 — DELIVERABILITY EN CRISIS
Hoy bounce 7d ~20.8%.
No desbloquear cold email simplemente subiendo el cap.
Objetivo:
- hard bounce ideal <1%;
- nunca escalar si >2–3%;
- validar contacto antes de enviar;
- evitar catch-all dudoso cuando no haya evidencia;
- priorizar emails oficiales explícitos y decisores verificados;
- suppression global por bounce/unsubscribe/rejection;
- separar reputación de outreach del correo transaccional/cliente de forma legítima;
- SPF/DKIM/DMARC correctos;
- no usar infraestructura para evadir controles anti-spam.

Mientras email frío esté pausado, redistribuir automáticamente capacidad a:
applications + intent + partners + ABM + warm + canales autorizados.

## PROBLEMA 7 — PARTNERS/WHITE-LABEL ESTÁ EN CERO
Hay 0 partner sent pese a que existen candidatos.
Crear Partner Engine operativo:
- AI agencies;
- Shopify agencies;
- CRM/GHL agencies;
- marketing agencies;
- software consultancies;
- n8n/Make implementers con overflow;
- nearshore agencies que necesiten delivery en español/LatAm.

Oferta: Catalina como delivery/AI automation/commerce ops partner, no como candidata a empleo.
Medir partner_sent -> reply -> call -> pilot -> recurring referrals.
## MERCADOS PRIORITARIOS — NO SOLO LATAM
Usar MARKET SCORE dinámico:
purchasing_power + observed_AI_demand + remote_contract_viability + language_fit + competition_penalty + vertical_fit.

Tier A para explorar con prioridad:
1. UAE/Dubai y Saudi/MENA — AI, WhatsApp, CRM, real estate, clinics, agencies, ecommerce.
2. Canada — contractor/agency/SMB, AI automation y integrations.
3. UK + Ireland — agencies, white-label, AI operations, n8n/integrations.
4. Australia — service businesses, agencies, AI automation contractors.
5. USA — especialmente Hispanic SMB, ecommerce, clinics, legal, real estate y agencies.
6. Netherlands/Nordics/Singapore/NZ — alto poder de compra, priorizar contract/agency remote.

Tier B selectivo:
- Germany: alto pago, pero muchas vacantes locales requieren residencia/alemán; priorizar agencies/startups English-first y contratos remotos.
- France: hay demanda freelance IA/n8n, pero priorizar rutas donde francés no sea barrera o generar copy nativo en francés sin fingir fluidez oral.
- Spain/Mexico/Chile/Colombia: ventaja idioma; mantener donde fit/ticket sea suficiente.

No premiar país por sí solo.
Filtrar automáticamente:
- visa/work-rights obligatorios;
- on-site;
- spoken English/French/German fluido como función central;
- salarios bajos frente a complejidad;
- competencia extrema si existe alternativa directa al decisor.

## MULTILINGÜE
Carolina debe investigar y escribir nativamente en el idioma del prospecto con LLM, pero nunca declarar que Catalina habla fluidamente un idioma que no habla.
Para conversaciones escritas: EN/ES/FR/DE/PT según necesidad.
Para reuniones: indicar español nativo + inglés oral básico apoyado por interpretación IA cuando sea relevante.
No abrir la objeción de idioma si la oportunidad no lo pregunta.

## MENSAJE OUTBOUND — MÁS FUERTE QUE BLIP
No usar pitch genérico.
Estructura obligatoria:
SIGNAL -> COST/HYPOTHESIS -> MICRO-PROOF -> SPECIFIC IDEA -> LOW-FRICTION CTA.

Ejemplo lógico, no plantilla literal:
“Vi [señal concreta de empresa]. En negocios así suele perderse [money moment específico].
Yo opero una marca DTC y construí LAURA/CAROLINA, sistemas propios que conectan WhatsApp, ecommerce, CRM, seguimiento y operaciones.
Para [empresa] veo una implementación concreta: [1 idea], sin reemplazar todo su stack.
Si te sirve, te envío un mapa de 2 minutos con cómo lo haría para ustedes; si hace sentido, vemos 15 min.”

Nunca inventar métricas.
Crear Proof Library verificable con:
- LAURA: arquitectura real, WhatsApp/Shopify/Dropi/CRM;
- CAROLINA: Revenue OS;
- Professional Glam: experiencia DTC/ops/growth;
- demos/screenshots/casos sin cifras inventadas.
Elegir prueba según vertical.

## ESTRATEGIA ADAPTATIVA REAL
Cada contacto debe llevar:
campaign_id, experiment_id, segment, country, vertical, channel, signal_type, angle, copy_version, offer_version, CTA_version.

Revisión cada 6h y daily close.
No cambiar copy por opens.
Reglas:
- bounce alto -> fuente/validación;
- delivered pero no human replies -> ICP/signal/hook/offer;
- replies pero no positive -> offer/fit;
- positive pero no meeting -> CTA/friction/followup;
- meetings pero no proposal -> qualification/discovery;
- proposals pero no won -> proof/scope/price/objections.

## DEFINITION OF DONE — NO NEGOCIABLE
No declarar Carolina lista hasta demostrar:
[ ] browser cloud sessions efectivamente saved/probed;
[ ] PC apagado no detiene discovery/queues/reporting;
[ ] Google Sheet sincroniza D1;
[ ] daily close llega y coincide con D1;
[ ] >0 partner outreach real;
[ ] >0 applications reales hoy por rutas permitidas, con provider_id;
[ ] marketplace/applications no se confunden con prepared;
[ ] cold email sigue protegido por deliverability guard;
[ ] intent/high-value markets se ejecutan, no solo existen como queries;
[ ] report por país/vertical/canal/copy;
[ ] learning engine cambia estrategia con evidencia;
[ ] meetings y WON son North Star;
[ ] todas las pruebas  E2E pasan;
[ ] despliegue cloud activo y commit push;
[ ] evidencia final con IDs/timestamps.

PRIMERO valida estos hallazgos. DESPUÉS implementa. NO me devuelvas un plan. Continúa hasta llegar a blockers que realmente requieran login/MFA/secret/decisión humana y presenta esos blockers al final, juntos.

## SMOKING GUN — EL PLANNER SABE EL DÉFICIT PERO LOS EXECUTORS NO LO LLENAN
Revenue plan auditado 2026-10-05T23:15Z:
- targetQualifiedActions: 75;
- coldOutreachPaused: true;
- targets: outbound 0, directApplications 20, marketplaces 15, intent 13, partners 12, ABM 6, followups 9;
- actual: outbound 10, directApplications 0, marketplaces 0, intent 14, partners 0, ABM 6, followups 17, meetings 0;
- deficits: directApplications 20, marketplaces 15, partners 12.

ESTE ES EL BUG ARQUITECTÓNICO CENTRAL:
el planner detecta y registra déficit, pero no existe/funciona una capa de execution scheduling que convierta deficits en acciones reales.

Implementa un Revenue Capacity Allocator:
1. lee revenue_plan después de cada ciclo;
2. para cada deficit llama al executor correspondiente;
3. consume solo oportunidades calificadas y no duplicadas;
4. continúa hasta llenar target, agotar inventario válido o encontrar blocker real;
5. registra attempted, executed, blocked, inventory_exhausted;
6. reintenta en el siguiente ciclo sin duplicar;
7. un executor roto no frena los demás;
8. target sin evidence de ejecución NO cuenta.

Añade test E2E específico:
coldOutreachPaused=true + deficits applications/marketplace/partners >0
=> el ciclo DEBE producir acciones reales en al menos los canales ejecutables o blockers específicos por cada deficit.

## THROUGHPUT SLA — NO NEGOCIABLE

Carolina no se considera operativa por "buscar" o "preparar". Se mide por acciones comerciales ejecutadas y reuniones.

### CAPACIDAD OBJETIVO FASE 1 (desde que executors/sesiones estén estables)
En una ventana de 24h:
- 300 negocios/oportunidades screened por reglas + modelos baratos.
- 120–200 negocios/oportunidades con research suficiente para decidir fit.
- 60 propuestas comerciales NUEVAS a empresas/decisores por día, distribuidas en canales seguros. NO significa 60 correos desde un solo dominio.
- 40 postulaciones SUBMITTED reales/día como piso inicial donde exista ruta permitida; subir hacia 60/día si APIs/forms/sesiones lo soportan.
- 20 partner/white-label pitches/día.
- 30–60 follow-ups/día.
- Total fase 1: >=150 acciones comerciales ejecutadas/día entre outbound + applications + partners + followups, siempre que inventario válido y seguridad de canal lo permitan.

### FASE 2
Si la tasa trailing de reuniones es insuficiente y los canales están sanos, escalar a 200–300 acciones calificadas/día multicanal.
No escalar un canal que tenga entregabilidad, bloqueo o policy risk.

### META DE REUNIONES
North Star: 10 reuniones calificadas/día como capacidad objetivo madura.
No falsear ni garantizar.
Calcular automáticamente:
required_actions = CEIL(target_meetings / trailing_14d_meeting_rate)
por canal y global.
Si no hay historial suficiente, usar experimentos pequeños por canal y recalibrar.
La tasa se calcula sobre SENT/SUBMITTED reales, no FOUND/PREPARED.

### COSTE DE IA
Dato real auditado hoy:
- 141 llamadas AI ≈ USD 0.46 total.
- intent.qualify con DeepSeek ≈ USD 0.000036/call.
- intent.proposal con Gemini ≈ USD 0.001406/call.
- application.route ≈ USD 0.007195/call (demasiado caro; optimizar).
- application.write ≈ USD 0.004648/call.

Objetivo:
- mantener hard cap USD 2/día inicialmente;
- apuntar a <= USD 1/día con 150+ acciones ejecutadas;
- no usar IA donde reglas/ATS/domain parsing resuelvan;
- application.route: detectar Lever/Greenhouse/Ashby/Workable/LinkedIn/Workana/Upwork/etc por URL/HTML determinísticamente y solo llamar IA/web si queda ambiguo;
- cachear research/company/context por 7–30 días;
- Gemini solo para final copy de alto fit;
- Sonnet solo para high-value/low-confidence;
- medir ai_cost_per_sent, ai_cost_per_submitted, ai_cost_per_positive_reply, ai_cost_per_meeting, no solo cost/call.

### EXECUTION SLA
Cada ciclo debe convertir deficits del revenue_plan en trabajo real.
Si target directApplications=20 y actual=0, no basta con boostApplications=true.
El executor debe intentar hasta:
(a) llenar el deficit,
(b) agotar inventario válido,
(c) encontrar un blocker específico y verificable.

Registrar:
planned, attempted, executed, blocked, inventory_exhausted, evidence_id.

Un deficit sin executor llamado es un BUG.

### DAILY SCOREBOARD OBLIGATORIO
A las 8pm America/Bogota enviar:
screened / researched / qualified / prepared / sent / submitted / delivered / positive replies / meetings booked / meetings held / proposals / won / revenue / AI cost.
Separado por:
channel, country, vertical, segment, copy_version, offer_version.
Además: motivo concreto por el que no se alcanzó cada objetivo diario.
