# Carolina Live Interpreter

Interpretación de voz en tiempo real para las reuniones de Catalina. En producción desde el 6-oct-2026.

## Contrato de producto
- Catalina sigue siendo quien habla y decide. La IA interpreta; no responde por ella ni la suplanta.
- Se avisa a los participantes (texto de aviso en la página, listo para copiar).
- Prioridad: el significado antes que el estilo. Los subtítulos de origen y de traducción quedan siempre visibles como respaldo.

## Cómo funciona
- `GET /interprete?t=<enlace>`: página con dos carriles. Solo abre con un enlace personal temporal: lo pide Catalina desde la página (le llega por correo, válido 12 h) o va incluido en cada cita confirmada (válido hasta 3 h después del inicio).
  - **Escuchar:** audio de la pestaña de la reunión → español en los audífonos de Catalina, con subtítulos.
  - **Hablar:** micrófono de Catalina → idioma del invitado, enviado al dispositivo de salida elegido. Con VB-Cable: "CABLE Input" en la página y "CABLE Output" como micrófono en Meet/Zoom/Teams. Sin VB-Cable funciona en modo subtítulos.
- `POST /interprete/session`: el Worker crea un client secret de vida corta de OpenAI `gpt-realtime-translate` para cada dirección. La clave `OPENAI_API_KEY` nunca llega al navegador. El navegador abre WebRTC directo con OpenAI.
- `POST /interprete/end`: guarda la transcripción en `meeting_notes` (`source='interpreter'`) y el costo real en `ai_calls` (`task='interpreter.session'`).

## Requisitos
- Secreto `OPENAI_API_KEY` en Cloudflare (`/health` → `interpreterReady`).
- Chrome de escritorio (captura de audio de pestaña y `setSinkId`).

## Costo
USD 0,034 por minuto por carril activo: una reunión de 30 minutos con los dos carriles cuesta unos USD 2.

## Pendiente
Pruebas de escucha humana con una reunión real antes de usarlo con un cliente.
