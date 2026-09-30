// Correo (ligero, compatible con Gmail/Outlook/móvil) y página de propuesta (inmersiva, animada).
// Ni el correo ni la página muestran precios: su trabajo es despertar interés y llevar a Carolina.
import { catalog } from '../../src/offers.js'

export const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const e = escapeHtml
const SITE = 'https://soycatalinajaramillo.com/'

function validate(company, proposal, proposalUrl) {
  const offer = catalog.find(o => ['esencial', 'ventas', 'ecommerce', 'multiagente', 'acompanamiento'].includes(o.id) && o.id === proposal.offer)
  if (!offer || !proposal.observation || !proposal.hypothesis || !proposal.solution) throw new Error('invalid_proposal')
  if (!String(proposalUrl).startsWith(SITE)) throw new Error('invalid_proposal_url')
  return offer
}
// Tipos de escena: conversación (atención/ventas), flujo automatizado (operaciones) y tablero (finanzas y dirección).
export const sceneType = s => s?.type === 'flujo' || s?.type === 'tablero' ? s.type : 'chat'
const sceneOf = p => {
  const s = p.scene
  if (!s) return null
  if (sceneType(s) === 'flujo') return Array.isArray(s.steps) && s.steps.filter(x => x?.what).length >= 3 ? s : null
  if (sceneType(s) === 'tablero') return Array.isArray(s.tiles) && s.tiles.filter(Boolean).length >= 3 ? s : null
  return ['customer', 'agent', 'handoff'].every(k => typeof s[k] === 'string' && s[k].trim()) ? s : null
}
const footer = (postal) => 'Idea preliminar preparada por Catalina Jaramillo con apoyo de Carolina, su asistente digital. Si prefiere no recibir más mensajes, responda BAJA y no volveremos a escribirle.' + (postal ? '<br>' + e(postal) : '')

function chatCard(scene, company) {
  return [
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1f1a15" style="margin-top:26px;background:#1f1a15;border:1px solid #3a3026;border-radius:14px">',
    '<tr><td style="padding:12px 16px;border-bottom:1px solid #3a3026;font:12px Arial,sans-serif;color:#b9a582"><span style="color:#7fd08f">&#9679;</span> ', e(scene.channel || 'Consulta'), ' &middot; ', e(scene.time || ''), '</td></tr>',
    '<tr><td style="padding:16px 16px 4px">',
    '<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:82%"><tr><td bgcolor="#efe6d6" style="background:#efe6d6;border-radius:14px 14px 14px 4px;padding:11px 14px;font:15px/1.45 Arial,sans-serif;color:#231e18">', e(scene.customer), '</td></tr></table>',
    '</td></tr><tr><td align="right" style="padding:10px 16px 4px">',
    '<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:86%"><tr><td bgcolor="#c6a26b" style="background:#c6a26b;border-radius:14px 14px 4px 14px;padding:11px 14px;font:15px/1.45 Arial,sans-serif;color:#1d1914;text-align:left">', e(scene.agent), '</td></tr></table>',
    '</td></tr><tr><td style="padding:12px 16px 16px;font:13px/1.45 Arial,sans-serif;color:#d4b078">&#8594; Llega a su equipo con: <span style="color:#efe6d6">', e(scene.handoff), '</span></td></tr>',
    '</table>',
    '<p style="margin:10px 0 0;font:11px/1.4 Arial,sans-serif;color:#8d7f6b">Simulación ilustrativa para ', e(company), ', preparada solo con la información pública de su web.</p>',
  ].join('')
}

function flowCard(scene, company) {
  const steps = scene.steps.filter(x => x?.what).slice(0, 5)
  return ['<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1f1a15" style="margin-top:26px;background:#1f1a15;border:1px solid #3a3026;border-radius:14px">',
    '<tr><td style="padding:12px 16px;border-bottom:1px solid #3a3026;font:12px Arial,sans-serif;color:#b9a582">&#9881; ', e(scene.title || 'Flujo automatizado'), '</td></tr>',
    ...steps.map((st, i) => '<tr><td style="padding:12px 16px ' + (i === steps.length - 1 ? '16px' : '0') + '"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td valign="top" style="width:30px;font:bold 13px Arial,sans-serif;color:#c6a26b">0' + (i + 1) + '</td><td style="font:14px/1.45 Arial,sans-serif;color:#efe6d6">' + (st.when ? '<span style="color:#b9a582">' + e(st.when) + ' · </span>' : '') + e(st.what) + '</td></tr></table></td></tr>'),
    '</table>', '<p style="margin:10px 0 0;font:11px/1.4 Arial,sans-serif;color:#8d7f6b">Ejemplo ilustrativo para ', e(company), ', a validar con su equipo y sus herramientas.</p>'].join('')
}
function boardCard(scene, company) {
  const tiles = scene.tiles.filter(Boolean).slice(0, 4)
  return ['<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1f1a15" style="margin-top:26px;background:#1f1a15;border:1px solid #3a3026;border-radius:14px">',
    '<tr><td colspan="2" style="padding:12px 16px;border-bottom:1px solid #3a3026;font:12px Arial,sans-serif;color:#b9a582">&#9636; ', e(scene.title || 'Tablero de control'), '</td></tr><tr>',
    ...tiles.map((t, i) => (i === 2 ? '</tr><tr>' : '') + '<td width="50%" style="padding:12px 16px"><div style="font:12px Arial,sans-serif;color:#b9a582">' + e(t) + '</div><div style="margin-top:6px;height:6px;border-radius:3px;background:#c6a26b;width:' + (40 + i * 13) + '%"></div></td>'),
    '</tr>', scene.alert ? '<tr><td colspan="2" style="padding:6px 16px 16px;font:13px/1.45 Arial,sans-serif;color:#d4b078">&#9888; ' + e(scene.alert) + '</td></tr>' : '',
    '</table>', '<p style="margin:10px 0 0;font:11px/1.4 Arial,sans-serif;color:#8d7f6b">Ejemplo ilustrativo para ', e(company), ': sin cifras reales; se diseña con sus datos.</p>'].join('')
}
const sceneCard = (scene, company) => sceneType(scene) === 'flujo' ? flowCard(scene, company) : sceneType(scene) === 'tablero' ? boardCard(scene, company) : chatCard(scene, company)

export function brandedProposal(company, proposal, proposalUrl = SITE + '#carolina', _bookingUrl = null, opts = {}) {
  validate(company, proposal, proposalUrl)
  const format = proposal.format === 'carta' ? 'carta' : 'visual'
  const hook = proposal.hook || 'Una idea concreta para atender mejor cada consulta'
  const scene = sceneOf(proposal)
  const source = typeof proposal.sourceUrl === 'string' && proposal.sourceUrl.startsWith('https://') ? proposal.sourceUrl : ''
  const preview = String(proposal.preview || proposal.example || proposal.hypothesis).slice(0, 140)
  const pre = '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' + e(preview) + '&zwnj;&nbsp;'.repeat(60) + '</div>'
  const ps = proposal.ps ? '<p style="margin:18px 0 0;font:14px/1.55 Arial,sans-serif;color:#4a4238"><strong>P. D.</strong> ' + e(proposal.ps) + '</p>' : ''
  const cta = (label) => '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 0"><tr><td bgcolor="#c6a26b" style="background:#c6a26b;border-radius:6px"><a href="' + e(proposalUrl) + '" style="display:inline-block;padding:15px 26px;font:bold 15px Arial,sans-serif;color:#1d1914;text-decoration:none">' + e(label) + ' &#8594;</a></td></tr></table>'
  const sourceLine = source ? '<p style="margin:0 0 20px;font:12px Arial,sans-serif;color:#81786b">Fuente: <a href="' + e(source) + '" style="color:#7a5a30">' + e(source.replace(/^https:\/\//, '').slice(0, 60)) + '</a></p>' : ''
  const head = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>' + e(proposal.subject || hook) + '</title></head>'

  if (format === 'carta') {
    return [head, '<body style="margin:0;background:#ffffff;color:#222;font-family:Arial,Helvetica,sans-serif">', pre,
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 18px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;font:15px/1.6 Arial,sans-serif;color:#222">',
      '<tr><td>',
      '<p style="margin:0 0 16px">Hola, equipo de ', e(company), ':</p>',
      '<p style="margin:0 0 6px">', e(proposal.observation), '</p>', sourceLine,
      '<p style="margin:0 0 16px">', e(proposal.hypothesis), '</p>',
      scene ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #c6a26b;margin:0 0 16px"><tr><td style="padding:4px 0 4px 14px;color:#3c352c">' + (sceneType(scene) === 'chat' ? '<em>«' + e(scene.customer) + '»</em><br><span style="color:#7a5a30">&#8594; ' + e(scene.agent) + '</span><br><span style="font-size:13px;color:#81786b">Su equipo recibe: ' + e(scene.handoff) + '</span>' : sceneType(scene) === 'flujo' ? scene.steps.filter(x => x?.what).slice(0, 5).map((st, i) => (i + 1) + '. ' + e(st.what)).join('<br>') : e(scene.title || 'Tablero') + ': ' + scene.tiles.filter(Boolean).slice(0, 4).map(e).join(' · ')) + '</td></tr></table>' : '<p style="margin:0 0 16px">' + e(proposal.example || '') + '</p>',
      '<p style="margin:0 0 16px">Preparé el recorrido completo para ', e(company), ' (2 minutos)', scene && sceneType(scene) === 'chat' ? ', con una demo que puede probar como si fuera su cliente' : '', ': <a href="', e(proposalUrl), '" style="color:#7a5a30;font-weight:bold">verlo aquí</a>. Si le hace sentido, respóndame y lo conversamos.</p>',
      '<p style="margin:0">Catalina Jaramillo<br><span style="color:#81786b;font-size:13px">Estrategia comercial, operación e IA · 15+ años · soycatalinajaramillo.com</span></p>', ps,
      '<p style="margin:26px 0 0;font:11px/1.5 Arial,sans-serif;color:#9a9186">', footer(opts.postal), '</p>',
      '</td></tr></table></td></tr></table></body></html>'].join('')
  }

  return [head, '<body style="margin:0;background:#ece5da;color:#25211c;font-family:Arial,Helvetica,sans-serif">', pre,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ece5da" style="background:#ece5da"><tr><td align="center" style="padding:20px 10px">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">',
    '<tr><td bgcolor="#14110e" style="background:#14110e;padding:18px 28px;border-radius:14px 14px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font:bold 11px Arial,sans-serif;letter-spacing:3px;color:#e3cfa9">CATALINA <span style="font-weight:normal">JARAMILLO</span></td><td align="right" style="font:11px Arial,sans-serif;color:#8d7f6b">Preparado para ', e(company), '</td></tr></table></td></tr>',
    '<tr><td bgcolor="#14110e" style="background:#14110e;padding:14px 28px 30px">',
    '<p style="margin:0 0 14px;font:bold 11px Arial,sans-serif;letter-spacing:2px;color:#c4a676">UNA ESCENA PARA ', e(company.toUpperCase()), '</p>',
    '<h1 style="margin:0;font:normal 34px/1.15 Georgia,\'Times New Roman\',serif;color:#f6ecdc">', e(hook), '</h1>',
    proposal.subhook ? '<p style="margin:14px 0 0;font:16px/1.5 Arial,sans-serif;color:#d9ccb6">' + e(proposal.subhook) + '</p>' : '',
    scene ? sceneCard(scene, company) : '',
    '</td></tr>',
    '<tr><td bgcolor="#faf7f1" style="background:#faf7f1;padding:28px 28px 8px;font:15px/1.6 Arial,sans-serif;color:#2a251f">',
    '<p style="margin:0 0 16px">Hola, equipo de ', e(company), ':</p>',
    '<p style="margin:0 0 4px;font:bold 11px Arial,sans-serif;letter-spacing:2px;color:#947347">LO QUE VI</p>',
    '<p style="margin:0 0 6px">', e(proposal.observation), '</p>', sourceLine,
    '<p style="margin:0 0 4px;font:bold 11px Arial,sans-serif;letter-spacing:2px;color:#947347">LA PREGUNTA</p>',
    '<p style="margin:0 0 20px">', e(proposal.hypothesis), '</p>',
    scene ? '' : '<p style="margin:0 0 20px;font-size:17px;color:#2f2921">' + e(proposal.example || '') + '</p>',
    cta('Ver el recorrido de ' + company),
    '<p style="margin:10px 0 0;font:13px/1.5 Arial,sans-serif;color:#74695a">', scene && sceneType(scene) !== 'chat' ? 'Allí verá el recorrido completo con el ejemplo aplicado a ' + e(company) + '.' : 'Incluye una demo que puede probar escribiéndole como si fuera su cliente.', ' Son 2 minutos; si no le interesa, basta con ignorar este correo.</p>',
    '<p style="margin:22px 0 0">Catalina Jaramillo<br><span style="color:#81786b;font-size:13px">Estrategia comercial, operación e inteligencia artificial · 15+ años</span></p>', ps,
    '</td></tr>',
    '<tr><td bgcolor="#f0e9df" style="background:#f0e9df;padding:18px 28px;border-radius:0 0 14px 14px;font:11px/1.5 Arial,sans-serif;color:#7d7366">', footer(opts.postal), '</td></tr>',
    '</table></td></tr></table></body></html>'].join('')
}

const phases = [
  ['Diagnóstico', 'Mapeamos con su equipo cómo llegan hoy las consultas, qué preguntan y qué pasa después.'],
  ['Prototipo', 'Un agente entrenado solo con información aprobada por ustedes, en su tono.'],
  ['Prueba supervisada', 'Casos reales con su equipo revisando cada respuesta antes de ampliar.'],
  ['Lanzamiento con control', 'Paso a una persona cuando hace falta y métricas acordadas desde el inicio.'],
]

function pageScene(scene, company) {
  if (sceneType(scene) === 'flujo') return `<div><div class="flow"><h4>⚙ ${e(scene.title || 'Flujo automatizado')}</h4>${scene.steps.filter(x => x?.what).slice(0, 5).map((st, i) => `<div class="st"><i>0${i + 1}</i><div>${st.when ? `<small>${e(st.when)}</small>` : ''}${e(st.what)}</div></div>`).join('')}</div><p class="cap">Ejemplo ilustrativo para ${e(company)}; se diseña y valida con su equipo y sus herramientas actuales.</p></div>`
  return `<div><div class="flow"><h4>▦ ${e(scene.title || 'Tablero de control')}</h4><div class="tiles">${scene.tiles.filter(Boolean).slice(0, 4).map(t => `<div class="tile"><span>${e(t)}</span><div class="bar2"></div></div>`).join('')}</div>${scene.alert ? `<div class="alert">⚠ ${e(scene.alert)}</div>` : ''}</div><p class="cap">Ejemplo ilustrativo para ${e(company)}: sin cifras reales; se construye con sus datos.</p></div>`
}

export function renderProposalPage({ id, company, proposal, subject, nonce = '', demo = true, bookingUrl = '' }) {
  const logo = typeof proposal.logo === 'string' && /^https:\/\/[^\s"'<>]+$/.test(proposal.logo) ? proposal.logo : ''
  const ex = proposal.executive && typeof proposal.executive === 'object' ? proposal.executive : null
  const measures = Array.isArray(ex?.measures) ? ex.measures.slice(0, 4) : []
  const scene = sceneOf(proposal)
  const moments = Array.isArray(proposal.moments) ? proposal.moments.slice(0, 3) : []
  const source = typeof proposal.sourceUrl === 'string' && proposal.sourceUrl.startsWith('https://') ? proposal.sourceUrl : (typeof proposal.source === 'string' && proposal.source.startsWith('https://') ? proposal.source : '')
  const talk = '/propuesta/' + encodeURIComponent(id) + '/hablar'
  const mail = 'mailto:clientes@soycatalinajaramillo.com?subject=' + encodeURIComponent('Re: ' + (subject || 'Recorrido para ' + company))
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${e(company)} · Un recorrido preparado por Catalina Jaramillo</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#14110e;--ink2:#1f1a15;--line:#3a3026;--gold:#c6a26b;--gold2:#e3cfa9;--ivory:#f6ecdc;--muted:#b3a58f;--paper:#faf7f1}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--ink);color:var(--ivory);font:16px/1.6 Manrope,Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}.wrap{max-width:1040px;margin:0 auto;padding:0 20px}
.top{display:flex;justify-content:space-between;align-items:center;padding:22px 0;font-size:11px;letter-spacing:.28em;color:var(--gold2)}.top b{font-weight:700}.top span{letter-spacing:.08em;color:var(--muted)}
.hero{position:relative;padding:64px 0 40px;overflow:hidden}.hero:before{content:"";position:absolute;inset:-40% -20% auto auto;width:720px;height:720px;background:radial-gradient(circle,rgba(198,162,107,.22),transparent 62%);filter:blur(10px);animation:glow 9s ease-in-out infinite alternate;pointer-events:none}
@keyframes glow{to{transform:translate(-60px,40px) scale(1.1)}}
.eyebrow{font-size:11px;letter-spacing:.3em;color:var(--gold);font-weight:700;text-transform:uppercase}
h1{font:500 clamp(40px,6.4vw,76px)/1.02 'Cormorant Garamond',Georgia,serif;margin:18px 0 18px;letter-spacing:-.01em;max-width:15ch}
.lead{font-size:clamp(17px,2vw,20px);color:#dccfb9;max-width:56ch}
.grid{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center}
.phone{background:linear-gradient(180deg,#221c16,#17130f);border:1px solid var(--line);border-radius:30px;padding:16px;box-shadow:0 40px 90px rgba(0,0,0,.55),0 0 0 8px #0e0c0a}
.bar{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--muted);padding:6px 8px 14px;border-bottom:1px solid var(--line)}.dot{width:8px;height:8px;border-radius:50%;background:#7fd08f;box-shadow:0 0 12px #7fd08f}
.msgs{padding:16px 4px 6px;min-height:300px;display:flex;flex-direction:column;gap:12px}
.b{max-width:84%;padding:12px 15px;border-radius:18px;font-size:15px;line-height:1.45;opacity:0;transform:translateY(10px) scale(.98);animation:in .55s cubic-bezier(.2,.8,.2,1) forwards}
.b.c{background:#efe6d6;color:#231e18;border-bottom-left-radius:5px;animation-delay:.5s}
.typing{align-self:flex-end;display:flex;gap:4px;padding:12px 14px;border-radius:16px;background:#2d251d;opacity:0;animation:in .3s 1.6s forwards,out .3s 3.1s forwards}.typing i{width:6px;height:6px;border-radius:50%;background:var(--gold);animation:bl 1s infinite}.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}
.b.a{align-self:flex-end;background:var(--gold);color:#1d1914;border-bottom-right-radius:5px;animation-delay:3.3s}
.hand{margin-top:6px;padding:12px 14px;border:1px dashed #5b4b34;border-radius:14px;font-size:13px;color:var(--gold2);opacity:0;animation:in .6s 4.6s forwards}.hand b{color:var(--ivory);font-weight:600}
.cap{font-size:11px;color:#8d7f6b;margin:12px 6px 0}
@keyframes in{to{opacity:1;transform:none}}@keyframes out{to{opacity:0;height:0;padding:0;margin:0}}@keyframes bl{50%{opacity:.25}}
section{padding:72px 0;border-top:1px solid #2a231c}.paper{background:var(--paper);color:#2a251f;border:0}.paper .eyebrow{color:#947347}
h2{font:500 clamp(30px,4vw,46px)/1.1 'Cormorant Garamond',Georgia,serif;margin:12px 0 22px;max-width:22ch}
.two{display:grid;grid-template-columns:1fr 1fr;gap:28px}.card{padding:26px;border-radius:18px;background:#fff;border:1px solid #e3d7c4}.card p{margin:8px 0 0}.src{font-size:13px;color:#81786b;word-break:break-all}.src a{color:#7a5a30}
.moments{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;counter-reset:m}.m{padding:26px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(180deg,#1c1813,#15120e);opacity:0;transform:translateY(16px);animation:in .7s forwards}.m:nth-child(2){animation-delay:.15s}.m:nth-child(3){animation-delay:.3s}
.m:before{counter-increment:m;content:"0" counter(m);font:600 13px Manrope;color:var(--gold);letter-spacing:.2em}.m h3{font:500 26px/1.15 'Cormorant Garamond',serif;margin:10px 0 8px;color:var(--ivory)}.m p{margin:0;color:#cbbfa9;font-size:15px}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:10px}.s{padding:20px;border-top:2px solid var(--gold);background:#fff;border-radius:0 0 14px 14px}.s b{display:block;font-size:14px;margin-bottom:6px}.s span{font-size:14px;color:#5e5549}
.note{margin-top:22px;font-size:14px;color:#655b4f}
.who{display:grid;grid-template-columns:auto 1fr;gap:26px;align-items:center}.mono{width:92px;height:92px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--gold);font:500 34px 'Cormorant Garamond',serif;color:var(--gold2)}
.exec{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.exec div{padding:24px;border:1px solid #e3d7c4;border-radius:16px;background:#fff}.exec h3{margin:0 0 8px;font:600 12px Manrope;letter-spacing:.22em;text-transform:uppercase;color:#947347}.exec p{margin:0;font-size:15px}
.kpis{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.kpis span{padding:10px 14px;border-radius:999px;background:#efe6d6;font-size:14px;color:#4a3a24}
.demo{display:grid;grid-template-columns:.9fr 1.1fr;gap:40px;align-items:start}.chatbox{background:linear-gradient(180deg,#221c16,#17130f);border:1px solid var(--line);border-radius:26px;padding:16px;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.log{height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:8px 4px}.log .b{opacity:1;transform:none;animation:none}.log .b.a{align-self:flex-end}.log .b.c{align-self:flex-start}
.ask{display:flex;gap:8px;margin-top:10px}.ask input{flex:1;background:#0f0c0a;border:1px solid var(--line);border-radius:999px;padding:13px 16px;color:var(--ivory);font:15px Manrope}.ask button{border:0;border-radius:999px;background:var(--gold);color:#1d1914;font-weight:700;padding:0 18px;cursor:pointer}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.chips button{background:transparent;border:1px solid #5b4b34;color:var(--gold2);border-radius:999px;padding:8px 12px;font:13px Manrope;cursor:pointer}
.after{display:none;margin-top:14px;padding:16px;border-radius:16px;background:#2a2119;border:1px solid #5b4b34;color:var(--gold2);font-size:14px}.after a{color:var(--ivory);font-weight:700}
@media(max-width:820px){.exec,.demo{grid-template-columns:1fr}.log{height:300px}}
.timeline{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:30px}.timeline div{padding:18px 0 0;border-top:1px solid var(--gold)}.timeline b{display:block;font:500 26px 'Cormorant Garamond',serif;color:var(--gold2)}.timeline span{font-size:14px;color:#cbbfa9}
.caps{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px}.caps div{padding:18px;border:1px solid var(--line);border-radius:14px;background:#17130f}.caps b{display:block;color:var(--ivory);font-size:15px;margin-bottom:6px}.caps span{font-size:13px;color:#b3a58f}
.dark .card{background:#1c1813;border-color:var(--line);color:#cbbfa9}.dark .card b{color:var(--gold2);letter-spacing:.08em;font-size:13px}
@media(max-width:820px){.timeline,.caps{grid-template-columns:1fr 1fr}}
.top .for{display:flex;align-items:center;gap:10px}.top .for img{height:30px;max-width:120px;object-fit:contain;background:#f6ecdc;border-radius:6px;padding:3px 6px}.top .for b{letter-spacing:.08em;color:var(--ivory);font-weight:600}
.flow{background:linear-gradient(180deg,#221c16,#17130f);border:1px solid var(--line);border-radius:24px;padding:22px}.flow h4{margin:0 0 14px;font:600 12px Manrope;letter-spacing:.22em;text-transform:uppercase;color:var(--gold)}.st{display:grid;grid-template-columns:34px 1fr;gap:10px;padding:12px 0;border-top:1px solid #2e261e;opacity:0;animation:in .6s forwards}.st:nth-child(2){animation-delay:.3s}.st:nth-child(3){animation-delay:.8s}.st:nth-child(4){animation-delay:1.3s}.st:nth-child(5){animation-delay:1.8s}.st:nth-child(6){animation-delay:2.3s}.st i{font-style:normal;font:600 13px Manrope;color:var(--gold)}.st small{display:block;color:var(--muted);font-size:12px}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tile{padding:16px;border:1px solid #3a3026;border-radius:14px;background:#1b1611;opacity:0;animation:in .6s forwards}.tile:nth-child(2){animation-delay:.2s}.tile:nth-child(3){animation-delay:.4s}.tile:nth-child(4){animation-delay:.6s}.tile span{font-size:13px;color:#cbbfa9}.bar2{margin-top:10px;height:6px;border-radius:3px;background:linear-gradient(90deg,var(--gold),transparent)}.alert{margin-top:12px;padding:12px 14px;border-radius:12px;border:1px dashed #5b4b34;color:var(--gold2);font-size:13px}
.cta{text-align:center;padding:90px 0}.btn{display:inline-block;padding:18px 30px;border-radius:999px;background:var(--gold);color:#1d1914;font-weight:700;text-decoration:none;box-shadow:0 12px 40px rgba(198,162,107,.35);transition:transform .2s}.btn:hover{transform:translateY(-2px)}
.ghost{display:inline-block;margin-top:16px;color:var(--gold2);font-size:14px}
footer{padding:28px 0 50px;font-size:12px;color:#8d7f6b;border-top:1px solid #2a231c}
@media(max-width:820px){.grid,.two,.moments,.steps,.exec{grid-template-columns:1fr}.hero{padding-top:30px}.phone{margin-top:10px}.who{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;opacity:1!important;transform:none!important}.typing{display:none}}
</style></head><body>
<div class="wrap top"><b>CATALINA&nbsp;<span style="letter-spacing:.28em;color:var(--gold2);font-weight:400">JARAMILLO</span></b><span class="for">Preparado para ${logo ? `<img src="${e(logo)}" alt="${e(company)}" referrerpolicy="no-referrer">` : ''}<b>${e(company)}</b></span></div>
<header class="hero"><div class="wrap grid">
<div><div class="eyebrow">Una escena para ${e(company)}</div><h1>${e(proposal.hook || 'Una idea para su próxima consulta')}</h1><p class="lead">${e(proposal.subhook || proposal.hypothesis)}</p>
<p style="margin-top:28px"><a class="btn" href="${talk}">Hablar con Carolina sobre ${e(company)}</a></p></div>
${scene && sceneType(scene) !== 'chat' ? pageScene(scene, company) : ''}${scene && sceneType(scene) === 'chat' ? `<div><div class="phone"><div class="bar"><span class="dot"></span>${e(scene.channel || 'Consulta')} · ${e(scene.time || '')}</div><div class="msgs"><div class="b c">${e(scene.customer)}</div><div class="typing"><i></i><i></i><i></i></div><div class="b a">${e(scene.agent)}</div><div class="hand">→ Llega a su equipo con: <b>${e(scene.handoff)}</b></div></div></div><p class="cap">Simulación ilustrativa, preparada solo con la información pública de su web. No es una conversación real.</p></div>` : ''}
</div></header>
${ex ? `<section class="paper"><div class="wrap"><div class="eyebrow">Resumen ejecutivo</div><h2>${e(ex.headline || 'Lo esencial, en un minuto')}</h2><div class="exec"><div><h3>Situación</h3><p>${e(ex.situation)}</p></div><div><h3>Oportunidad</h3><p>${e(ex.opportunity)}</p></div><div><h3>Enfoque</h3><p>${e(ex.approach)}</p></div></div>${measures.length ? `<p style="margin:26px 0 0;font-size:13px;letter-spacing:.18em;color:#947347;font-weight:700">QUÉ MEDIRÍAMOS DESDE EL PRIMER DÍA</p><div class="kpis">${measures.map(m => `<span>${e(m)}</span>`).join('')}</div>` : ''}<p class="note">Son hipótesis a validar con su equipo; no prometemos cifras antes de conocer su proceso.</p></div></section>` : ''}
<section class="paper"><div class="wrap"><div class="eyebrow">Por qué pensamos en ustedes</div><h2>Lo que vimos, y lo que nos preguntamos</h2>
<div class="two"><div class="card"><div class="eyebrow">Lo que vi</div><p>${e(proposal.observation)}</p>${source ? `<p class="src">Fuente: <a href="${e(source)}" rel="noopener nofollow">${e(source.replace(/^https:\/\//, ''))}</a></p>` : ''}</div>
<div class="card"><div class="eyebrow">La pregunta</div><p>${e(proposal.hypothesis)}</p><p class="src">Es una hipótesis: solo su equipo sabe cómo funciona hoy su proceso.</p></div></div></div></section>
${moments.length === 3 ? `<section><div class="wrap"><div class="eyebrow">El recorrido de su cliente</div><h2>Tres momentos que podrían sentirse distintos</h2><div class="moments">${moments.map(m => `<div class="m"><h3>${e(m.title)}</h3><p>${e(m.text)}</p></div>`).join('')}</div></div></section>` : ''}
${demo && (!scene || sceneType(scene) === 'chat') ? `<section id="demo"><div class="wrap demo"><div><div class="eyebrow">Pruébelo usted mismo</div><h2>Escríbale como si fuera uno de sus clientes</h2><p style="color:#cbbfa9;margin:0 0 14px">Preparamos una demostración con la información pública de ${e(company)}. Pregúntele por un servicio, un horario o cómo reservar, y vea cómo respondería.</p><p class="cap" style="margin:0">Demostración: solo usa datos públicos de su web. En un proyecto real se entrena con información aprobada por su equipo y con supervisión humana.</p></div>
<div class="chatbox"><div class="bar"><span class="dot"></span>Asistente de ${e(company)} · demo</div><div class="log" id="log"><div class="b a">${e(proposal.demoGreeting || 'Hola, gracias por escribir a ' + company + '. ¿En qué le puedo ayudar?')}</div></div>
<div class="chips" id="chips">${(Array.isArray(proposal.demoPrompts) ? proposal.demoPrompts.slice(0, 3) : scene ? [scene.customer] : []).map(q => `<button type="button">${e(q)}</button>`).join('')}</div>
<form class="ask" id="ask"><input id="q" maxlength="400" autocomplete="off" placeholder="Escriba como lo haría un cliente…" aria-label="Mensaje para la demo"><button>Enviar</button></form>
<div class="after" id="after">¿Le gustaría algo así para ${e(company)}, entrenado con su información real? <a href="${talk}">Hablar con Carolina →</a></div></div></div></section>` : ''}
<section class="paper"><div class="wrap"><div class="eyebrow">Cómo lo exploraríamos</div><h2>Con su equipo al mando, paso a paso</h2><p style="max-width:70ch">${e(proposal.solution)}</p>
<div class="steps">${phases.map(([t, d]) => `<div class="s"><b>${t}</b><span>${d}</span></div>`).join('')}</div>
<p class="note">Siempre con supervisión humana: el agente no reemplaza a su equipo, le entrega contexto. Cualquier conexión con agenda, CRM o tienda se valida antes con ustedes. El alcance final se define tras conversar.</p></div></section>
<section><div class="wrap"><div class="eyebrow">Quién diseña su sistema</div><h2>Estrategia comercial, operación e inteligencia artificial</h2>
<div class="who"><div class="mono">CJ</div><p style="color:#cbbfa9;max-width:72ch;margin:0">Catalina Jaramillo diseña cómo debe vender, atender y operar una empresa, y dirige la construcción del sistema que lo hace realidad. Habla el idioma del dueño del negocio y el de la tecnología.</p></div>
<div class="timeline">${[['2009', 'Directora comercial y de marketing de Biboban, empresa textil colombiana.'], ['2013', 'Consultora de empresas y expertos en servicio, equipos de ventas, cierre por WhatsApp, retención y lanzamientos (incluidos un referente de neuroventas en México y una marca de muebles en Ecuador).'], ['2018', 'Funda Professional Glam: tres sedes físicas en Colombia, empresa en Florida y tienda online con más de COP 1.000 millones en ventas en Shopify.*'], ['Hoy', 'Diseña sistemas de IA para empresas de EE. UU. y Latinoamérica, desde un agente puntual hasta la operación completa.']].map(([y, t]) => `<div><b>${y}</b><span>${t}</span></div>`).join('')}</div>
<p class="eyebrow" style="margin-top:44px">Lo que diseñamos</p>
<div class="caps">${[['Ventas', 'Respuesta 24/7, calificación, agenda y seguimiento de oportunidades.'], ['Atención y postventa', 'WhatsApp, redes y web; devoluciones, cancelaciones y escalamiento humano.'], ['E-commerce', 'Carritos abandonados, estado de pedidos, venta cruzada y recompra.'], ['Marketing y redes', 'Comentarios y mensajes que se convierten en oportunidades y nurturing.'], ['Crecimiento', 'Funnels, Meta Ads, remarketing, retención y analítica.'], ['Operaciones', 'Flujos automatizados entre formularios, CRM, WhatsApp, correo, agenda y reportes.'], ['Finanzas y control', 'Tableros de rentabilidad real, alertas de fugas y conciliación de pedidos y pagos.'], ['Sistema integral', 'Agentes coordinados bajo reglas, permisos y supervisión humana: la empresa como sistema.']].map(([t, d]) => `<div><b>${t}</b><span>${d}</span></div>`).join('')}</div>
<p class="eyebrow" style="margin-top:44px">Sistemas en producción</p>
<div class="two dark"><div class="card"><b>LAURA · SISTEMA MULTIAGENTE</b><p>Coordina ventas, atención, pedidos, postventa e inteligencia comercial en Professional Glam, con supervisión humana.</p></div><div class="card"><b>CAROLINA · AGENTE DE DESARROLLO COMERCIAL</b><p>Esta propuesta la preparó Carolina: encontró su negocio, estudió su web, diagnosticó oportunidades y la escribió para ${e(company)}. Así trabaja un sistema bien diseñado.</p></div></div>
<p class="cap" style="margin-top:14px">* Resultados comerciales de Professional Glam (sedes físicas y Shopify), no atribuidos a la IA. Reuniones en español.</p></div></section>
<section class="cta"><div class="wrap"><div class="eyebrow">Siguiente paso</div><h2 style="margin:12px auto 18px">¿Le gustaría ver cómo funcionaría con los casos reales de ${e(company)}?</h2>
<p style="color:#cbbfa9;max-width:58ch;margin:0 auto 30px">Carolina le hace unas preguntas rápidas sobre su proceso. Si hay encaje, coordina una conversación de 20–30 minutos con Catalina. Sin compromiso.</p>
<a class="btn" href="${talk}">Hablar con Carolina ahora</a>${bookingUrl ? `<br><a class="ghost" style="font-size:16px;font-weight:600" href="/propuesta/${encodeURIComponent(id)}/agendar">o agendar directamente 30 minutos con Catalina →</a>` : ''}<br><a class="ghost" href="${e(mail)}">o responder por correo</a></div></section>
<footer><div class="wrap">Idea preliminar, no es una cotización ni una oferta vinculante. Preparada por Catalina Jaramillo con apoyo de Carolina, su asistente digital, a partir de información pública. Si prefiere no recibir más mensajes, responda BAJA al correo. · <a href="${SITE}">soycatalinajaramillo.com</a></div></footer>
${demo && (!scene || sceneType(scene) === 'chat') ? `<script nonce="${e(nonce)}">(()=>{const log=document.getElementById('log'),form=document.getElementById('ask'),q=document.getElementById('q'),after=document.getElementById('after'),msgs=[];let busy=false;
const add=(role,text)=>{const d=document.createElement('div');d.className='b '+(role==='user'?'c':'a');d.textContent=text;log.appendChild(d);log.scrollTop=log.scrollHeight;return d};
async function send(text){if(busy||!text.trim())return;busy=true;add('user',text);msgs.push({role:'user',content:text});const t=add('assistant','…');
try{const r=await fetch('/propuesta/${encodeURIComponent(id)}/demo',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:msgs})});const j=await r.json();t.textContent=j.reply||j.error||'No pude responder.';if(j.reply)msgs.push({role:'assistant',content:j.reply});if(msgs.length>=4||j.done)after.style.display='block'}catch{t.textContent='No pude responder. Inténtelo de nuevo.'}busy=false}
form.addEventListener('submit',ev=>{ev.preventDefault();const v=q.value;q.value='';send(v)});
document.querySelectorAll('#chips button').forEach(b=>b.addEventListener('click',()=>send(b.textContent)))})()</script>` : ''}
</body></html>`
}
