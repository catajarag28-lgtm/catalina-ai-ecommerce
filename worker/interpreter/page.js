// Página del intérprete. Dos carriles independientes (una sesión de traducción por idioma de salida):
//  ESCUCHAR: audio de la pestaña de la reunión → español en los audífonos de Catalina + subtítulos.
//  HABLAR:   micrófono de Catalina → idioma del invitado, enviado al dispositivo de salida elegido
//            (p. ej. "CABLE Input" de VB-Cable para que Meet/Zoom lo use como micrófono) + subtítulos.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export function interpreterPage({ token, access, ready, languages }) {
  const opts = Object.entries(languages).filter(([k]) => k !== 'es').map(([k, v]) => `<option value="${k}"${k === (access?.guestLanguage || 'en') ? ' selected' : ''}>${esc(v.label)}</option>`).join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Intérprete de Carolina</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Instrument+Sans:wght@400;600&display=swap">
<style>
:root{--bg:#f5f4f2;--surface:#fff;--fg:#1c1a18;--muted:#68625b;--line:#e2ddd6;--accent:#7a4f34;--ok:#2d6a4b;--warn:#9a6511;--bad:#a3322b;--display:'Fraunces',Georgia,serif;--body:'Instrument Sans',system-ui,sans-serif;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#151312;--surface:#1e1c1a;--fg:#ebe6e0;--muted:#a59d94;--line:#33302c;--accent:#d49c76;--ok:#78c49c;--warn:#e2b25e;--bad:#e88a82;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 var(--body);padding:24px 16px 48px}
main{max-width:1080px;margin:0 auto;display:grid;gap:18px}h1{font:600 30px/1.15 var(--display);margin:0}h2{font:600 19px/1.2 var(--display);margin:0}
.muted{color:var(--muted)}.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px;display:grid;gap:12px}
.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.lanes{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:820px){.lanes{grid-template-columns:1fr}}
button{font:600 14px var(--body);border:0;border-radius:10px;padding:11px 16px;background:var(--fg);color:var(--bg);cursor:pointer}button.alt{background:transparent;color:var(--fg);border:1px solid var(--line)}button:disabled{opacity:.45;cursor:not-allowed}button:focus-visible,select:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
select{font:14px var(--body);padding:9px 10px;border-radius:9px;border:1px solid var(--line);background:var(--surface);color:var(--fg);max-width:100%}
.pane{min-height:120px;max-height:260px;overflow:auto;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px 12px;white-space:pre-wrap;font-size:14px}
.pane.big{font-size:18px;line-height:1.45}.label{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--line);margin-right:6px}.on .dot{background:var(--ok)}.status{font-size:13px}
.lat{font-size:12px;border:1px solid currentColor;border-radius:999px;padding:1px 8px}.lat.ok{color:var(--ok)}.lat.warn{color:var(--warn)}.lat.bad{color:var(--bad)}
.note{background:var(--surface);border:1px dashed var(--line);border-radius:10px;padding:10px 12px;font-size:13px}.err{color:var(--bad)}
</style></head><body><main>
<header><h1>Intérprete de Carolina</h1><p class="muted">Traducción de voz en tiempo real para tus reuniones. Tú sigues hablando en español; la IA solo interpreta, no responde por ti.</p></header>
${!ready ? '<div class="note err">Falta configurar la clave <b>OPENAI_API_KEY</b> en Cloudflare. Hasta entonces el intérprete no puede abrir sesiones.</div>' : ''}
${!token ? `<div class="card"><h2>Necesitas tu enlace personal</h2><p class="muted">Por seguridad, el intérprete solo abre con un enlace temporal que Carolina envía a tu correo (también va dentro de cada cita confirmada).</p><div class="row"><button id="req">Enviar enlace a mi correo</button><span id="reqmsg" class="status"></span></div></div>
<script>document.getElementById('req').onclick=async()=>{const m=document.getElementById('reqmsg');m.textContent='Enviando…';const r=await fetch('/interprete/request',{method:'POST'});m.textContent=r.ok?'Listo: revisa tu correo.':'No se pudo enviar ('+r.status+').'}</script>` : `
<div class="card">
  <div class="row"><label for="guest" class="label">Idioma del invitado</label><select id="guest">${opts}</select>
  <label for="sink" class="label">Salida de tu voz traducida</label><select id="sink"><option value="">Altavoz / audífonos por defecto</option></select>
  <button class="alt" id="copy">Copiar aviso de interpretación</button></div>
  <p class="muted" id="disclosure" style="margin:0;font-size:13px">I use AI-assisted live interpretation so we can each speak naturally in our preferred language.</p>
  <div class="note">Cómo usarlo: 1) Abre tu reunión en otra pestaña de Chrome. 2) <b>Escuchar</b>: elige esa pestaña y marca «Compartir audio de la pestaña»; oirás la traducción al español. 3) <b>Hablar</b>: para que el invitado oiga tu voz traducida, en «Salida» elige <b>CABLE Input</b> (VB-Cable, gratis) y en Meet/Zoom elige <b>CABLE Output</b> como micrófono. Sin VB-Cable funciona en modo subtítulos: lee la traducción en pantalla.</div>
</div>
<div class="lanes">
  <section class="card" id="laneListen"><div class="row"><h2>Escuchar</h2><span class="status"><span class="dot"></span><span class="st">apagado</span></span><span class="lat ok" hidden></span></div>
    <p class="muted" style="margin:0">Ellos hablan · tú oyes español</p>
    <div class="row"><button data-start="listen">Empezar a escuchar</button><button class="alt" data-stop="listen" disabled>Detener</button></div>
    <div class="label">Traducción al español</div><div class="pane big" data-out></div><div class="label">Lo que dijeron (original)</div><div class="pane" data-in></div></section>
  <section class="card" id="laneSpeak"><div class="row"><h2>Hablar</h2><span class="status"><span class="dot"></span><span class="st">apagado</span></span><span class="lat ok" hidden></span></div>
    <p class="muted" style="margin:0">Tú hablas español · ellos oyen su idioma</p>
    <div class="row"><button data-start="speak">Empezar a hablar</button><button class="alt" data-stop="speak" disabled>Detener</button></div>
    <div class="label">Tu voz traducida</div><div class="pane big" data-out></div><div class="label">Lo que dijiste (español)</div><div class="pane" data-in></div></section>
</div>
<div class="card"><div class="row"><button id="end">Terminar y guardar transcripción</button><span id="endmsg" class="status muted"></span></div><p class="muted" style="margin:0;font-size:13px">Costo aproximado: USD 0,034 por minuto por cada carril activo. La transcripción queda en las notas de reunión de Carolina.</p></div>
<script>
const T=${JSON.stringify(token)};const lanes={};const $=s=>document.querySelector(s)
const lane=d=>d==='listen'?$('#laneListen'):$('#laneSpeak')
function setState(d,on,text){const el=lane(d);el.classList.toggle('on',on);el.querySelector('.st').textContent=text;el.querySelector('[data-start]').disabled=on;el.querySelector('[data-stop]').disabled=!on}
function showLat(d,ms){const b=lane(d).querySelector('.lat');b.hidden=false;b.className='lat '+(ms<=1800?'ok':ms<=2500?'warn':'bad');b.textContent=(ms/1000).toFixed(1)+' s'}
async function listSinks(){try{const ds=await navigator.mediaDevices.enumerateDevices();const s=$('#sink');const cur=s.value;s.innerHTML='<option value="">Altavoz / audífonos por defecto</option>'+ds.filter(d=>d.kind==='audiooutput'&&d.deviceId!=='default').map(d=>'<option value="'+d.deviceId+'">'+(d.label||'Salida de audio').replace(/[<>&]/g,'')+'</option>').join('');const cable=ds.find(d=>d.kind==='audiooutput'&&/cable input/i.test(d.label));s.value=cur||(cable?cable.deviceId:'')}catch{}}
async function start(d){
  setState(d,true,'conectando…')
  try{
    const ses=await fetch('/interprete/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({t:T,direction:d,guestLanguage:$('#guest').value})}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j})
    $('#disclosure').textContent=ses.disclosure
    let src
    if(d==='listen'){src=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});src.getVideoTracks().forEach(t=>t.stop());if(!src.getAudioTracks().length)throw new Error('No compartiste el audio de la pestaña: vuelve a intentarlo y marca «Compartir audio».')}
    else{src=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});listSinks()}
    const pc=new RTCPeerConnection();pc.addTrack(src.getAudioTracks()[0],src)
    const audio=new Audio();audio.autoplay=true
    if(d==='speak'&&$('#sink').value&&audio.setSinkId)await audio.setSinkId($('#sink').value).catch(()=>{})
    pc.ontrack=({streams})=>{audio.srcObject=streams[0]}
    const ch=pc.createDataChannel('oai-events');const L={pc,src,audio,ch,startedAt:Date.now(),out:'',inp:'',lastIn:0}
    const outEl=lane(d).querySelector('[data-out]'),inEl=lane(d).querySelector('[data-in]')
    ch.onmessage=({data})=>{let e;try{e=JSON.parse(data)}catch{return}
      if(e.type==='session.input_transcript.delta'){L.inp+=e.delta;inEl.textContent=L.inp.slice(-4000);inEl.scrollTop=inEl.scrollHeight;if(!L.lastIn)L.lastIn=Date.now()}
      if(e.type==='session.output_transcript.delta'){L.out+=e.delta;outEl.textContent=L.out.slice(-4000);outEl.scrollTop=outEl.scrollHeight;if(L.lastIn){showLat(d,Date.now()-L.lastIn);L.lastIn=0}}
      if(e.type==='error'||e.error)setState(d,true,'error: '+(e.error?.message||'desconocido'))
      if(e.type==='session.closed')L.closed=true}
    ch.onopen=()=>setState(d,true,'activo')
    const offer=await pc.createOffer();await pc.setLocalDescription(offer)
    const ans=await fetch(ses.callsUrl,{method:'POST',headers:{authorization:'Bearer '+ses.clientSecret,'content-type':'application/sdp'},body:offer.sdp})
    if(!ans.ok)throw new Error('La sesión de traducción rechazó la conexión: '+(await ans.text()).slice(0,160))
    await pc.setRemoteDescription({type:'answer',sdp:await ans.text()})
    src.getAudioTracks()[0].onended=()=>stop(d)
    lanes[d]=L
  }catch(err){setState(d,false,'apagado');lane(d).querySelector('[data-out]').textContent='⚠ '+err.message}
}
async function stop(d){const L=lanes[d];if(!L)return;try{if(L.ch.readyState==='open')L.ch.send(JSON.stringify({type:'session.close'}))}catch{}
  for(let i=0;i<30&&!L.closed;i++)await new Promise(r=>setTimeout(r,100))
  L.src.getTracks().forEach(t=>t.stop());L.pc.close();L.minutes=(Date.now()-L.startedAt)/60000;L.done=true;setState(d,false,'apagado')}
document.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>start(b.dataset.start))
document.querySelectorAll('[data-stop]').forEach(b=>b.onclick=()=>stop(b.dataset.stop))
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#disclosure').textContent);$('#copy').textContent='Aviso copiado'}catch{}}
$('#end').onclick=async()=>{await stop('listen');await stop('speak');const m=(d)=>lanes[d]?.minutes||0
  const r=await fetch('/interprete/end',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({t:T,guestLanguage:$('#guest').value,minutes:{listen:m('listen'),speak:m('speak')},transcripts:{listen:lanes.listen?.out||'',listenSource:lanes.listen?.inp||'',speak:lanes.speak?.out||'',speakSource:lanes.speak?.inp||''}})}).then(r=>r.json()).catch(()=>null)
  $('#endmsg').textContent=r?.ok?('Guardado · '+r.minutes.toFixed(1)+' min · USD '+r.cost):'No se pudo guardar.'}
listSinks()
</script>`}
</main></body></html>`
}
