# Carolina: contactos, investigación y propuestas

## Estado verificado el 30 de septiembre de 2026 (motor creativo v2)

### Cómo trabaja Carolina
1. **Descubre** (`worker/discovery.js`): cada 15 min, si la cola tiene menos del doble del cupo diario, busca en la web por segmento (OpenRouter + Exa) y verifica cada negocio abriendo su propia web: activo, con correo publicado en su sitio, con encaje comercial y evidencia literal. Los aprobados entran a la cola autorizada; los rechazados quedan en `prospect_candidates` con el motivo.
   - Prioridad: hispanos en EE. UU. (Miami primero), Puerto Rico y Panamá, México con ticket alto; Colombia solo premium con clientela internacional.
   - **España excluida del correo en frío**: la LSSI exige consentimiento previo incluso entre empresas.
2. **Investiga** (`researchBusiness`): portada y páginas de contacto, servicios y reservas; detecta herramientas en el HTML (Booksy, Vagaro, Square, WhatsApp, chat, Shopify, CRM…). La ausencia de una señal no prueba carencia.
3. **Diagnostica y escribe** (`worker/outreach.js` + `worker/copywriting.js`): servicios, canales, oportunidades como hipótesis y encaje (si es bajo, no escribe). Redacta con el enfoque elegido y ejemplos de lo que funcionó; un director creativo (segunda llamada al modelo) puntúa especificidad, curiosidad, claridad, credibilidad, deseo y CTA, y si algo baja de 7 se reescribe. Un linter bloquea precio, carencias inventadas, asuntos de spam y burbujas largas.
4. **Envía** solo en días hábiles de 8:00 a 17:00 en la zona horaria del destinatario, sin precio, con escena de WhatsApp o web, un único CTA y opción BAJA (también en la cabecera List-Unsubscribe).
5. **Seguimiento único** a los 4 días si no hubo respuesta, rebote, queja ni baja.
6. **Aprende** (`worker/creative.js`): 5 enfoques iniciales compiten con muestreo de Thompson según una puntuación (respuesta 1 · clic «Hablar con Carolina» 0,8 · visita o clic 0,5 · apertura 0,2). Cada día retira los que rinden menos de la mitad del mejor (o tienen menos del 12 % de aperturas tras 25 envíos) y crea enfoques nuevos a partir de los datos. Te avisa de cada cambio.
7. **Volumen**: por decisión de Catalina (30-sep) arranca directamente en 30 al día (cupo en `outreach_control.daily_cap`); antes arrancaba en 5 al día y sube de 5 en 5 solo con 2 días al cupo actual, cero quejas, menos del 3 % de rebotes e interés de al menos 3 % o alguna respuesta. Techo: `OUTREACH_DAILY_LIMIT` = 30 (máximo 50). Pausa automática ante quejas, rebotes de 5 % o más, o 50 entregados sin interés.
8. **Demo en vivo** (`worker/demo.js`): la página de cada propuesta incluye un chat donde el prospecto le escribe al asistente que podría tener su negocio, entrenado solo con la información pública de su web (máx. 8 turnos, 40 mensajes al día por propuesta, sin consejo clínico ni legal). Te avisa cuando alguien la usa: es la señal de interés más fuerte.
9. **Resumen ejecutivo**: situación, oportunidad, enfoque e indicadores a medir, en tono de consultor senior, sin cifras prometidas.
10. **Aprendizaje de respuestas**: una respuesta con interés (reunión, pregunta, prospecto) vale 1; una respuesta sin interés, 0,3; una reunión agendada, 1. Las últimas respuestas de prospectos (objeciones e intereses) se incluyen al escribir la siguiente propuesta.
11. **Seguimiento caliente** (`runHotFollowup`): si un negocio probó la demo, pidió hablar o vio su propuesta y no respondió, Carolina le escribe una vez en el mismo hilo para llevarlo a la reunión con Catalina. Catalina solo atiende reuniones.
12. **Ciclos**: completo cada 15 min + ciclo solo de envío a los minutos 7 y 37.
13. **Embudo**: el botón de la propuesta pasa por `/propuesta/<id>/hablar` (te avisa en el primer clic) y abre el chat con `?p=<id>`: Carolina continúa con el contexto de esa propuesta.

### Bloqueos para escribir a prospectos nuevos (el sistema los respeta solo)
- `SENDER_POSTAL_ADDRESS`: CONFIGURADA el 30-sep (14818 SW 180th Terrace, Miami, FL 33187). Dirección postal obligatoria por CAN-SPAM en los correos comerciales a EE. UU. (sirve un buzón virtual o un apartado postal).
- Métricas de Resend: CONECTADAS el 30-sep (webhook existente reactivado con clave rotada; la expuesta quedó inválida). Verificado: email.sent y email.delivered registrados con firma.
- Avisos a Catalina: `catalinajaramillogirldo28@gmail.com` VERIFICADO en Cloudflare el 30-sep.

### Dónde consultar
- `/health`: `metricsReady`, `postalReady`, `outreachEnabled`.
- D1 `carolina-portfolio`: `outreach` (envíos, asunto, enfoque, investigación en `research`), `outreach_events` (entregas, aperturas, clics, visitas, clic en CTA, chats), `outreach_angles` (enfoques activos y retirados con motivo), `prospect_candidates` (descubrimiento con motivos de rechazo), `outreach_control` (pausa y cupo diario).
- Correo a Catalina: cada propuesta enviada (diagnóstico, oportunidades, paquete sugerido interno), cada clic en «Hablar con Carolina», cambios de enfoque o de volumen y el informe de los lunes.
- Muestras: `/muestra-correo-carolina.html`, `/muestra-correo-carta.html`, `/muestra-propuesta-carolina.html` (negocio ficticio).
