import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA = process.env.CAROLINA_DATA || '/data';
const PROFILE = process.env.CAROLINA_AUTH_PROFILE || '/data/browser-profile';
const QUEUE = path.join(DATA, 'carolina-commercial-queue.json');
const LEDGER = path.join(DATA, 'carolina-action-ledger.jsonl');
const RESULT = path.join(DATA, 'carolina-action-results.json');
const STATUS = path.join(DATA, 'carolina-action-status.md');
// AUTO-SUBMIT controlado: 'live' exige CAROLINA_AUTOSUBMIT_APPROVED=yes; CAPTCHA/MFA/pagos/campos desconocidos siempre frenan.
const MODE = (process.env.CAROLINA_AUTOSUBMIT_APPROVED === 'yes' ? (process.env.CAROLINA_ACTION_MODE || 'dry') : 'dry').toLowerCase();
const RUN_LIMIT = Number(process.env.CAROLINA_ACTION_LIMIT || 10);
const DAILY_LIMIT = Number(process.env.CAROLINA_DAILY_LIMIT || 50);
const PER_PLATFORM_LIMIT = Number(process.env.CAROLINA_PER_PLATFORM_LIMIT || 5);
const DAILY_PLATFORM_LIMIT = Number(process.env.CAROLINA_DAILY_PLATFORM_LIMIT || 20);
const ONLY_URLS = new Set(String(process.env.CAROLINA_ONLY_URLS || '').split(',').map(x=>x.trim()).filter(Boolean));
const WORKER_BASE = String(process.env.CAROLINA_WORKER_BASE || 'https://soycatalinajaramillo.com').replace(/\/$/, '');
const VM_TOKEN = process.env.CAROLINA_VM_TOKEN || '';
const PRIORITY_QUEUE = process.env.CAROLINA_PRIORITY_QUEUE_FILE || path.join(DATA, 'carolina-priority-queue.json');
const LOCAL_QUEUE_ONLY = process.env.CAROLINA_LOCAL_QUEUE_ONLY === 'yes';
const CV_EN = '/public/Catalina_Jaramillo_AI_Automation_Resume_2026_EN.pdf';
const CV_ES = '/public/Catalina_Jaramillo_AI_Automation_Resume_2026.pdf';

fs.mkdirSync(DATA, { recursive: true });

const BLOCKER_RX = /(captcha|recaptcha|verify you are human|verification required|two[- ]factor|2fa|mfa|security check|just a moment|cloudflare|buy (?:more )?credits|proposal credits|connects required|purchase connects|upgrade (?:your )?plan|membership required|payment required|credit card required)/i;
const LOGIN_RX = /(sign in|log in|login|iniciar sesi[oó]n|ingresar)/i;
const FALSE_TITLE_RX = /(^|\b)(for hire|available for hire|open to work|seeking work|probar premium|premium por|find jobs|saved jobs|posted jobs|portfolio projects|automation$|available for projects|hire me)(\b|$)/i;
const FALSE_URL_RX = /\/premium\/|\/tag\/|\/tags\/|\/pricing\/|\/products\/|\/search(?:[/?]|$)/i;
const RELEVANT_RX = /(ai|artificial intelligence|automation|automatizaci[oó]n|ecommerce|e-commerce|shopify|crm|whatsapp|n8n|make\.com|lead generation|growth|marketing|operations|python|bedrock|agent|llm|sales|customer experience|project manager|product)/i;
const HIRING_COMMUNITY_RX = /(hiring|looking for|need (?:an?|someone)|seeking (?:an?|someone)|wanted|paid|long[- ]term|contract|freelancer|specialist|expert|consultant|busco|contratando|contratar|proyecto pagado)/i;
const PRE_APPLY_RX = /(easy apply|apply now|apply for|apply to position|send proposal|submit proposal|make an offer|send a quote|quote now|enviar propuesta|postularme|postular|solicitar|presentar propuesta)/i;
const NEXT_RX = /^(next|continue|review|siguiente|continuar|revisar)$/i;
const FINAL_RX = /(submit application|send application|submit proposal|send proposal|send quote|submit quote|enviar postulaci[oó]n|enviar propuesta|presentar solicitud|submit$|enviar$)/i;
const CONFIRM_RX = /(application submitted|application sent|proposal sent|quote sent|successfully applied|you applied|already applied|thanks for applying|thank you for applying|postulaci[oó]n enviada|propuesta enviada|solicitud enviada|ya te postulaste|application received)/i;

function attachConfirmation(result,s){
  const match=s.body.match(CONFIRM_RX);
  if(!match) return false;
  result.confirmationText=match[0].slice(0,120);
  result.confirmationUrl=s.url;
  result.providerId='vm:visible:'+crypto.createHash('sha256').update([result.url,s.url,match[0],s.body.slice(0,1000)].join('|')).digest('hex').slice(0,32);
  return true;
}
function now(){ return new Date().toISOString(); }
function append(row){
  const out = { ts: now(), ...row };
  fs.appendFileSync(LEDGER, JSON.stringify(out) + '\n');
  console.log(JSON.stringify(out));
  return out;
}
function loadJson(file, fallback){ try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch { return fallback; } }
async function fetchCanonicalQueue(){
  if(LOCAL_QUEUE_ONLY){
    const q=loadJson(PRIORITY_QUEUE,null);
    if(!q||!Array.isArray(q.items)) throw new Error('priority_queue_missing_or_invalid');
    return {source:'priority_local_verified',items:q.items};
  }
  if(!VM_TOKEN) throw new Error('CAROLINA_VM_TOKEN missing');
  const res=await fetch(WORKER_BASE+'/ops/vm-queue?limit=50',{headers:{authorization:'Bearer '+VM_TOKEN},signal:AbortSignal.timeout(30000)});
  if(!res.ok) throw new Error('vm_queue_http_'+res.status);
  const q=await res.json();
  if(q.source!=='worker_canonical_opportunities'||!Array.isArray(q.items)) throw new Error('invalid_canonical_queue');
  fs.writeFileSync(QUEUE,JSON.stringify(q,null,2));
  return q;
}
async function syncResult(row){
  if(!VM_TOKEN||!row?.url||!row?.status) return false;
  const res=await fetch(WORKER_BASE+'/ops/vm-result',{method:'POST',headers:{authorization:'Bearer '+VM_TOKEN,'content-type':'application/json'},body:JSON.stringify(row),signal:AbortSignal.timeout(20000)}).catch(()=>null);
  return !!res?.ok;
}
function loadLedger(){
  try { return fs.readFileSync(LEDGER,'utf8').split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x)); } catch { return []; }
}
function utcDay(ts){ return String(ts || '').slice(0,10); }
function platformKey(p){
  const s=String(p||'').toLowerCase();
  if(s.includes('linkedin')) return 'linkedin';
  if(s.includes('twine')) return 'twine';
  if(s.includes('guru')) return 'guru';
  if(s.includes('peopleperhour')) return 'peopleperhour';
  if(s.includes('workana')) return 'workana';
  if(s.includes('n8n')) return 'n8n';
  if(s.includes('make')) return 'make';
  return s.replace(/\W+/g,'_');
}
// CloudSessionHealth: solo plataformas CONNECTED (probe real del perfil persistente, < 3 h).
const SESSION_HEALTH = path.join(DATA, 'session-health.json');
function sessionConnected(p){
  try{
    const h = JSON.parse(fs.readFileSync(SESSION_HEALTH,'utf8'));
    if(Date.now() - Date.parse(h.at) > 3*3600*1000) return false;
    return (h.results||[]).some(r => r.platform === p && r.verdict === 'CONNECTED');
  }catch{ return false; }
}
function validCandidate(x){
  const title=String(x.title||'').trim(), url=String(x.url||'');
  const p=platformKey(x.platform);
  const canonicalProposal=String(x.proposal||'').trim();
  if(canonicalProposal.split(/\s+/).length<80) return false;
  if(!url || FALSE_TITLE_RX.test(title) || FALSE_URL_RX.test(url) || !RELEVANT_RX.test(`${title} ${url}`)) return false;
  // LinkedIn: no depender de easyApply del discovery. La página real decide si es Easy Apply, Apply externo o requiere humano.
  if(p==='linkedin' && !/linkedin\.com\/jobs\/view\//i.test(url)) return false;
  if((p==='n8n'||p==='make') && (!/\/t\//i.test(url) || !HIRING_COMMUNITY_RX.test(title))) return false;
  if(p==='workana') return false;
  if(!sessionConnected(p)) return false;
  return ['twine','guru','peopleperhour','linkedin','n8n','make'].includes(p);
}
function proposalText(item){
  const canonical=String(item.proposal||'').trim();
  if(canonical.split(/\s+/).length>=80) return canonical;
  const p=platformKey(item.platform);
  const es = p==='n8n'||p==='make'||/automatizaci[oó]n|ventas|whatsapp|colombia|latam|méxico|españa/i.test(String(item.title||''));
  const t=String(item.title||'').replace(/\s+/g,' ').trim();
  if(es){
    return `Hola, soy Catalina Jaramillo. Vi la oportunidad “${t.slice(0,120)}” y me interesa porque conecta directamente con lo que construyo: sistemas de agentes de IA, automatización comercial, CRM, WhatsApp/ecommerce y seguimiento de ventas.\n\nNo trabajo la automatización como un flujo aislado. Primero mapeo el proceso, identifico dónde se pierden prospectos o tiempo operativo y construyo un MVP medible. Puedo empezar con una auditoría rápida, proponer la arquitectura y ejecutar la primera versión con foco en conversión, seguimiento y confiabilidad.\n\nPerfil y casos: https://soycatalinajaramillo.com/perfil-catalina.html\n\n¿Cuál es el cuello de botella principal que quieren resolver primero?`;
  }
  return `Hi, I'm Catalina Jaramillo. I saw the “${t.slice(0,120)}” opportunity and it maps closely to the systems I build: AI agents, sales automation, CRM, WhatsApp/ecommerce operations and follow-up workflows.\n\nI don't treat automation as an isolated workflow. I first map the process, identify where leads or operational time are leaking, and build a measurable MVP. I can start with a quick audit, propose the architecture, and deliver the first working version with clear conversion, follow-up and reliability metrics.\n\nProfile and work: https://soycatalinajaramillo.com/catalina-profile.html\n\nWhat is the main operational bottleneck you want to solve first?`;
}
async function visibleText(page){
  return ((await page.locator('body').innerText({timeout:5000}).catch(()=>'')) || '').slice(0,18000);
}
async function snapshot(page){
  const title=await page.title().catch(()=>''), url=page.url(), body=await visibleText(page);
  return {title,url,body,all:`${title}\n${url}\n${body}`};
}
async function visibleButtons(page){
  return page.locator('button, a, input[type=submit], input[type=button]').evaluateAll(els => els.map((el,idx)=>({
    idx,
    text:(el.innerText||el.value||el.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,160),
    disabled:!!el.disabled,
    visible:!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length)
  })).filter(x=>x.visible && x.text && !x.disabled));
}
async function clickByText(page, rx){
  const els = page.locator('button, a, input[type=submit], input[type=button]');
  const n=await els.count();
  for(let i=0;i<n;i++){
    const el=els.nth(i);
    if(!(await el.isVisible().catch(()=>false)) || await el.isDisabled().catch(()=>true)) continue;
    const txt=((await el.innerText().catch(()=>'')) || (await el.getAttribute('value').catch(()=>'')) || (await el.getAttribute('aria-label').catch(()=>'')) || '').trim().replace(/\s+/g,' ');
    if(txt && rx.test(txt)){ await el.click({timeout:5000}).catch(()=>{}); return txt; }
  }
  return '';
}
async function clickApplyRoute(page,p){
  if(p==='linkedin' && !/linkedin[.]com$/i.test(new URL(page.url()).hostname.replace(/^www[.]/,''))) return clickByText(page,PRE_APPLY_RX);
  if(p==='linkedin'){
    const els=page.locator('button, a, input[type=submit], input[type=button]');
    const n=await els.count();
    for(let i=0;i<n;i++){
      const el=els.nth(i);
      if(!(await el.isVisible().catch(()=>false)) || await el.isDisabled().catch(()=>true)) continue;
      const txt=((await el.innerText().catch(()=>'')) || (await el.getAttribute('value').catch(()=>'')) || (await el.getAttribute('aria-label').catch(()=>'')) || '').trim().replace(/\s+/g,' ');
      const href=await el.getAttribute('href').catch(()=>null);
      const tag=await el.evaluate(n=>n.tagName).catch(()=>'');
      const applyText=/^(easy apply|apply(?: now| for (?:this )?(?:job|role))?|solicitud sencilla|solicitar|postularme)$/i.test(txt) || (txt.length<=60 && /easy apply/i.test(txt));
      if(!applyText) continue;
      if(tag==='A' && href && /linkedin\.com\/jobs\/view\//i.test(href)) continue;
      if(href && /^https?:\/\//i.test(href)){ await page.goto(href,{waitUntil:'domcontentloaded',timeout:45000}); return txt; }
      await el.click({timeout:5000}).catch(()=>{}); return txt;
    }
    return '';
  }
  return clickByText(page,PRE_APPLY_RX);
}
async function fillProposal(page, text){
  let filled=0;
  const areas=page.locator('textarea');
  for(let i=0;i<Math.min(await areas.count(),3);i++){
    const el=areas.nth(i);
    if(await el.isVisible().catch(()=>false) && !(await el.isDisabled().catch(()=>true))){
      const existing=await el.inputValue().catch(()=> '');
      if(!existing.trim()){ await el.fill(text).catch(()=>{}); filled++; }
    }
  }
  const editables=page.locator('[contenteditable="true"]');
  for(let i=0;i<Math.min(await editables.count(),2);i++){
    const el=editables.nth(i);
    if(await el.isVisible().catch(()=>false)){
      const existing=(await el.innerText().catch(()=>''))||'';
      if(!existing.trim()){ await el.fill(text).catch(()=>{}); filled++; }
    }
  }
  return filled;
}
async function attachResume(page, lang='en'){
  const f=lang==='es'?CV_ES:CV_EN;
  if(!fs.existsSync(f)) return 0;
  let attached=0;
  const inputs=page.locator('input[type=file]');
  for(let i=0;i<await inputs.count();i++){
    const el=inputs.nth(i);
    if(await el.isEnabled().catch(()=>false)){
      await el.setInputFiles(f).catch(()=>{});
      attached++;
      break;
    }
  }
  return attached;
}
async function fillKnownIdentity(page){
  const email=process.env.CAROLINA_APPLICANT_EMAIL || 'catalinajaramillogirldo28@gmail.com';
  const phone=process.env.CATALINA_WHATSAPP || '';
  const address=process.env.SENDER_POSTAL_ADDRESS || '';
  const inputs=page.locator('input[type=text],input[type=email],input[type=tel]');
  let filled=0;
  for(let i=0;i<Math.min(await inputs.count(),30);i++){
    const el=inputs.nth(i);
    if(!(await el.isVisible().catch(()=>false)) || await el.isDisabled().catch(()=>true)) continue;
    if(String(await el.inputValue().catch(()=>'' )).trim()) continue;
    const name=String(await el.getAttribute('name').catch(()=>'')||'');
    const placeholder=String(await el.getAttribute('placeholder').catch(()=>'')||'');
    const type=String(await el.getAttribute('type').catch(()=>'')||'');
    let value='';
    if(/^(cName|full[_-]?name|applicant[_-]?name)$/i.test(name) || /^(full name|nombre completo)$/i.test(placeholder)) value='Catalina Jaramillo';
    else if(/^(first[_-]?name|cFirstName)$/i.test(name)) value='Catalina';
    else if(/^(last[_-]?name|cLastName)$/i.test(name)) value='Jaramillo';
    else if(type==='email' || /^(cEmail|applicant[_-]?email)$/i.test(name)) value=email;
    else if(type==='tel' || /phone|mobile|whatsapp|tel[eé]fono|celular/i.test(name+' '+placeholder)) value=phone;
    else if(/address|direcci[oó]n|street|postal/i.test(name+' '+placeholder)) value=address;
    if(value){ await el.fill(value).catch(()=>{}); filled++; }
  }
  return filled;
}
async function fillKnownPreferences(page){
  const body=String(await page.locator('body').innerText().catch(()=>''));
  const spanish=/españa|spain|euro|eur/i.test(body), chile=/chile|clp|santiago/i.test(body), texas=/texas|united states|usa|usd|hourly/i.test(body);
  const monthly=spanish?'3500':chile?'3000000':'3500';
  const annual=spanish?'42000':chile?'36000000':'42000';
  const hourly=texas?'40':'40';
  let filled=0;
  const fields=page.locator('input[type=text],input[type=number],input[type=tel],select');
  for(let i=0;i<Math.min(await fields.count(),40);i++){
    const el=fields.nth(i); if(!(await el.isVisible().catch(()=>false))||await el.isDisabled().catch(()=>true)) continue;
    const value=String(await el.inputValue().catch(()=>'')); if(value.trim()) continue;
    const meta=String(await el.getAttribute('name').catch(()=>'')||'')+' '+String(await el.getAttribute('id').catch(()=> '')||'')+' '+String(await el.getAttribute('placeholder').catch(()=> '')||'');
    const parent=String(await el.evaluate(e=>(e.labels?.[0]?.innerText||e.closest('fieldset')?.innerText||e.parentElement?.innerText||'').slice(0,240)).catch(()=>''));
    const label=(meta+' '+parent).toLowerCase();
    if(/current|previous|actual salary|salario actual|last drawn/.test(label)) continue;
    if(/hourly|per hour|por hora|rate|tarifa/.test(label)){ await el.fill(hourly).catch(()=>{}); filled++; continue; }
    if(/annual|yearly|per year|anual|por año/.test(label)){ await el.fill(annual).catch(()=>{}); filled++; continue; }
    if(/salary|compensation|sueldo|salario|monthly|mensual/.test(label)){ await el.fill(monthly).catch(()=>{}); filled++; continue; }
    if(/availability|full.?time|dedication|disponibilidad|jornada/.test(label) && await el.evaluate(e=>e.tagName==='SELECT').catch(()=>false)){
      const opts=await el.locator('option').allTextContents().catch(()=>[]); const idx=opts.findIndex(x=>/full.?time|tiempo completo|full time/i.test(x)); if(idx>=0){await el.selectOption({label:opts[idx]}).catch(()=>{});filled++;}
    }
  }
  return filled;
}async function requiredUnknown(page){
  return page.locator('input,textarea,select').evaluateAll(els => els.filter(el=>{
    const visible=!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length);
    if(!visible || el.disabled || !el.required) return false;
    const type=(el.type||'').toLowerCase();
    if(['hidden','submit','button','file','checkbox','radio'].includes(type)) return false;
    return !String(el.value||'').trim();
  }).map(el=>({tag:el.tagName,type:el.type||'',name:el.name||'',placeholder:el.placeholder||'',aria:el.getAttribute('aria-label')||'',label:(el.labels?.[0]?.innerText||el.closest('fieldset')?.querySelector('legend')?.innerText||el.closest('[class*=question],[class*=field],[data-test]')?.innerText||'').trim().slice(0,180)})).slice(0,12));
}
async function confirm(page){
  await page.waitForTimeout(2500);
  const s=await snapshot(page);
  return CONFIRM_RX.test(s.all) ? s : null;
}
async function actOn(page,item){
  const p=platformKey(item.platform), proposal=proposalText(item);
  const result={platform:p,title:item.title,url:item.url,status:'UNKNOWN',reason:'',mode:MODE};
  await page.goto(item.url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(2500);
  let s=await snapshot(page);
  if(/you applied|already applied|ya te postulaste/i.test(s.body) && attachConfirmation(result,s)){ result.status='ALREADY_APPLIED_OR_CONFIRMED'; result.reason='existing confirmation visible'; return result; }
  if(item.verifyOnly){ result.status='SUBMIT_CLICKED_UNCONFIRMED'; result.reason='reopened without a visible submission confirmation'; result.currentUrl=page.url(); return result; }
  if(BLOCKER_RX.test(s.all)){ result.status='WAITING_HUMAN_BLOCKER'; result.reason=(s.all.match(BLOCKER_RX)||[])[0]||'security/cost blocker'; return result; }
  if(LOGIN_RX.test(s.title+' '+s.url) && /login|signin|auth/i.test(s.url)){ result.status='WAITING_HUMAN_LOGIN'; result.reason='session not accepted'; return result; }
  if(p==='n8n'||p==='make'){
    const emails=(s.body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)||[]).map(x=>x.toLowerCase());
    const unique=[...new Set(emails)];
    result.status=unique.length?'DIRECT_CONTACT_FOUND':'WAITING_HUMAN_COMMUNITY_REPLY';
    result.reason=unique.length?`explicit contact found: ${unique.slice(0,2).join(', ')}`:'public reply/contact route requires review; no blind forum spam';
    result.contacts=unique.slice(0,3);
    return result;
  }
  const pre=await clickApplyRoute(page,p);
  if(!pre){ result.status='WAITING_HUMAN_NO_APPLY_ROUTE'; result.reason='no clear apply/proposal button'; result.currentUrl=page.url(); result.visibleActions=(await visibleButtons(page)).slice(0,12).map(x=>x.text); return result; }
  result.openedWith=pre;
  await page.waitForTimeout(1800);
  for(let step=0;step<6;step++){
    s=await snapshot(page);
    if(/you applied|already applied|ya te postulaste/i.test(s.body) && attachConfirmation(result,s)){ result.status='ALREADY_APPLIED_OR_CONFIRMED'; result.reason='existing confirmation visible'; return result; }
    if(BLOCKER_RX.test(s.all)){ result.status='WAITING_HUMAN_BLOCKER'; result.reason=(s.all.match(BLOCKER_RX)||[])[0]||'security/cost blocker'; return result; }
    result.proposalFields=(result.proposalFields||0)+await fillProposal(page,proposal);
    result.identityFields=(result.identityFields||0)+await fillKnownIdentity(page);
    result.preferenceFields=(result.preferenceFields||0)+await fillKnownPreferences(page);
    result.filesAttached=(result.filesAttached||0)+await attachResume(page,/españ|colombia|latam|méxico|automatiz/i.test(s.all)?'es':'en');
    await page.waitForTimeout(500);
    const unknown=await requiredUnknown(page);
    if(unknown.length){
      result.status='WAITING_HUMAN_FIELDS';
      result.reason='required factual fields need user-specific answers';
      result.fields=unknown;
      result.currentUrl=page.url();
      return result;
    }
    const buttons=await visibleButtons(page);
    const final=buttons.find(b=>FINAL_RX.test(b.text) && !/request a proposal|sign in|login|upgrade|pay|buy/i.test(b.text));
    if(final){
      result.finalButton=final.text;
      if(MODE!=='live'){ result.status='READY_TO_SUBMIT_DRY_RUN'; result.reason='safe final submit found'; return result; }
      const clicked=await clickByText(page,new RegExp(final.text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
      result.clicked=clicked||final.text;
      const c=await confirm(page);
      if(c && attachConfirmation(result,c)){ result.status='SUBMITTED_CONFIRMED'; result.reason='visible confirmation detected after submit'; return result; }
      result.status='SUBMIT_CLICKED_UNCONFIRMED'; result.reason='final button clicked but no clear confirmation'; return result;
    }
    const next=buttons.find(b=>NEXT_RX.test(b.text));
    if(next){
      await clickByText(page,new RegExp('^'+next.text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','i'));
      await page.waitForTimeout(1200);
      continue;
    }
    const nextApply=await clickApplyRoute(page,p);
    if(nextApply){
      result.applyHops=(result.applyHops||0)+1;
      await page.waitForTimeout(1500);
      continue;
    }
    result.status='PREPARED_NO_FINAL_BUTTON';
    result.reason='proposal prepared but no safe final/next button';
    result.currentUrl=page.url();
    result.visibleActions=(await visibleButtons(page)).slice(0,12).map(x=>x.text);
    return result;
  }
  result.status='WAITING_HUMAN_MULTISTEP';
  result.reason='application exceeded safe automatic step limit';
  result.currentUrl=page.url();
  result.visibleActions=(await visibleButtons(page)).slice(0,12).map(x=>x.text);
  return result;
}
async function main(){
  const q=await fetchCanonicalQueue();
  const ledger=loadLedger();
  const day=utcDay(now());
  const confirmedToday=ledger.filter(x=>utcDay(x.ts)===day && ['SUBMITTED_CONFIRMED','ALREADY_APPLIED_OR_CONFIRMED'].includes(x.status));
  if(confirmedToday.length>=DAILY_LIMIT){
    fs.writeFileSync(RESULT,JSON.stringify({ts:now(),status:'DAILY_LIMIT_REACHED',confirmedToday:confirmedToday.length},null,2));
    return;
  }
  const recentByUrl=new Map();
  for(const x of ledger){ if(x.url) recentByUrl.set(x.url,x); }
  const candidates=(q.items||[])
    .filter(x=>!ONLY_URLS.size || ONLY_URLS.has(String(x.url||'')))
    .filter(x=>['ENVIABLE_PRIORIDAD_ALTA','ENVIABLE_PRIORIDAD_MEDIA'].includes(x.status))
    .filter(validCandidate)
    .filter(x=>{
      const prev=recentByUrl.get(x.url);
      if(!prev) return true;
      if(['SUBMITTED_CONFIRMED','ALREADY_APPLIED_OR_CONFIRMED'].includes(prev.status)) return false;
      const age=Date.now()-Date.parse(prev.ts||0);
      if(prev.status==='SUBMIT_CLICKED_UNCONFIRMED') return (LOCAL_QUEUE_ONLY && MODE!=='live') || age>24*3600*1000;
      if(LOCAL_QUEUE_ONLY) return true;
      return age>24*3600*1000;
    });
  const confirmedByPlatform={};
  for(const x of confirmedToday){ const p=platformKey(x.platform); confirmedByPlatform[p]=(confirmedByPlatform[p]||0)+1; }
  const selected=[], counts={};
  for(const x of candidates){
    const p=platformKey(x.platform);
    if((confirmedByPlatform[p]||0)>=DAILY_PLATFORM_LIMIT) continue;
    const remainingPlatform=Math.max(0,DAILY_PLATFORM_LIMIT-(confirmedByPlatform[p]||0));
    if((counts[p]||0)>=Math.min(PER_PLATFORM_LIMIT,remainingPlatform)) continue;
    selected.push({...x,verifyOnly:recentByUrl.get(x.url)?.status==='SUBMIT_CLICKED_UNCONFIRMED'}); counts[p]=(counts[p]||0)+1;
    if(selected.length>=Math.min(RUN_LIMIT,Math.max(0,DAILY_LIMIT-confirmedToday.length))) break;
  }
  const context=await chromium.launchPersistentContext(PROFILE,{
    headless:true,
    viewport:{width:1365,height:900},
    args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']
  });
  const results=[];
  try{
    for(const item of selected){
      const page=await context.newPage();
      try{
        const r=await actOn(page,item);
        const saved=append(r);
        saved.workerSynced=await syncResult(saved);
        results.push(saved);
      }catch(e){
        const saved=append({platform:platformKey(item.platform),title:item.title,url:item.url,status:'ERROR',reason:String(e.message||e),mode:MODE});
        saved.workerSynced=await syncResult(saved);
        results.push(saved);
      }finally{ await page.close().catch(()=>{}); }
      await new Promise(r=>setTimeout(r,900));
    }
  }finally{ await context.close().catch(()=>{}); }
  const countsOut=results.reduce((a,r)=>{a[r.status]=(a[r.status]||0)+1;return a},{});
  const out={ts:now(),mode:MODE,selected:selected.length,counts:countsOut,results};
  fs.writeFileSync(RESULT,JSON.stringify(out,null,2));
  const lines=['# Carolina Action Status',`Updated: ${out.ts}`,`Mode: ${MODE}`,`Selected this cycle: ${selected.length}`,'','## Results'];
  for(const [k,v] of Object.entries(countsOut)) lines.push(`- ${k}: ${v}`);
  lines.push('','## Evidence');
  for(const r of results) lines.push(`- ${r.status} — ${r.platform} — ${r.title} — ${r.url}${r.reason?` — ${r.reason}`:''}`);
  fs.writeFileSync(STATUS,lines.join('\n'));
  console.log(JSON.stringify({type:'carolina_action_cycle_completed',...out},null,2));
}
main().catch(e=>{append({status:'FATAL',reason:String(e.message||e),mode:MODE});process.exit(1)});
