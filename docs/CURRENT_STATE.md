# Carolina: estado actual (9-oct-2026)

Fuente única de verdad de la arquitectura activa. Laura pertenece a Professional Glam; Carolina es independiente.

## Dónde corre
- **Cloudflare Worker `carolina-portfolio-api`** en `soycatalinajaramillo.com`: crons `*/15` (ciclo completo) y `7,37` (envíos), D1 `carolina-portfolio`, Browser Run y KV de sesiones. No depende de Laura ni de la PC para ejecutar postulaciones.
- **Google Cloud propio de Carolina**: proyecto `project-b6f40d8a-4ecd-4a7d-831` (nombre visible `Carolina AI Acquisition`), separado del proyecto de Laura. Está vacío de buckets y datasets; Compute Engine no está habilitado y no hay VM. Comparte la cuenta de facturación, por lo que crear una VM requiere verificar un límite de gasto real antes de activarla.
- **VM `laura` de Professional Glam**: los temporizadores `carolina-application-runner.timer`, `carolina-cloud-runner.timer` y `carolina-linkedin-discover.timer` quedaron deshabilitados el 9 de octubre. No ejecutar Carolina allí. Los archivos históricos de Carolina no se borraron para preservar datos hasta una migración separada.
- **Puente `/ops/vm-*`**: responde 410 salvo que exista una VM dedicada a Carolina y se configure `CAROLINA_DEDICATED_VM_ENABLED=true`. Los scripts de `vm/` rechazan el host `laura`.

## Flujo activo
1. Descubrimiento: búsqueda pública de intención, categoría de proyectos de n8n y bolsas de vacantes remotas. LinkedIn se usa como referencia manual; no hay automatización de su cuenta.
2. Calificación: `opportunities` puntúa encaje, crea un brief y una propuesta en el idioma de la oferta solo para A/B que pasan el control de calidad.
3. Ejecución: el Worker verifica rutas explícitas y envía candidaturas por correo o formulario ATS oficial mediante Browser Run. Usa el CV en español o inglés según la oferta y comprueba la carga antes de enviar. CAPTCHA, MFA, costos o preguntas personales sin respuesta detienen esa ruta.
4. Correo: Resend desde `clientes@`/`catalina@`, respuestas asociadas por dominio y freno por rebotes.
5. Resultado: `/health.commercialScorecard` separa contratos firmados y anticipos cobrados. Encontrada, preparada y enviada son estados distintos; solo una confirmación verificable cuenta como envío.

## Restricción comercial
Catalina no cuenta con una red personal de posibles clientes. Carolina no reserva capacidad para referidos ni solicita contactos conocidos; busca compradores con necesidades publicadas y rutas de postulación verificables. Los contactos por formularios oficiales de empresas priorizan marcas ecommerce.

## LinkedIn
LinkedIn prohíbe herramientas de terceros que automaticen búsqueda, invitaciones y mensajes, incluso si usan navegador, mouse y teclado. Carolina prepara notas breves basadas en hechos públicos, pero Catalina decide el envío dentro de LinkedIn. La prioridad automática son las rutas oficiales fuera de LinkedIn.

## IA y medición
Las llamadas pasan por `worker/core/modelRouter.js`, con costo registrado en `ai_calls` y tope de USD 2 al día. `capacityAllocation.expectedRevenuePerDay` es solo pronóstico (`forecastOnly: true`). Los contratos y anticipos se registran con evidencia mediante `POST /ops/commercial-deal`.

## Pendientes conocidos
- No hay garantía de cubrir todas las vacantes de internet: algunas no publican ruta utilizable o requieren datos personales. Las oportunidades bloqueadas se registran sin contarse como enviadas.
- Las sesiones propias de Carolina en Browser Run para plataformas con inicio de sesión figuran como MISSING. Solo correo explícito y formularios públicos pueden enviarse sin ellas; no se reutilizan sesiones de Laura.
- La cola anterior de la VM no produjo formularios aptos; queda retirada junto con esa VM.
- Intérprete en tiempo real (`/interprete`) requiere `OPENAI_API_KEY`.
- Repositorio público: hacerlo privado. Despliegue automático: renovar `CLOUDFLARE_API_TOKEN` en GitHub.
