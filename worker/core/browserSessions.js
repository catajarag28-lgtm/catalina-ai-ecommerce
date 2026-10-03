import { launch, connect } from '@cloudflare/playwright'
import { notifyCatalina } from './notify.js'

const enc=new TextEncoder()
const dec=new TextDecoder()

const PLATFORM_CONFIG={
  linkedin:{label:'LinkedIn',home:'https://www.linkedin.com/feed/',login:'https://www.linkedin.com/login',domains:['linkedin.com'],loginPattern:/\/login|checkpoint|authwall/i},
  upwork:{label:'Upwork',home:'https://www.upwork.com/nx/find-work/',login:'https://www.upwork.com/ab/account-security/login',domains:['upwork.com'],loginPattern:/login|account-security/i},
  workana:{label:'Workana',home:'https://www.workana.com/dashboard',login:'https://www.workana.com/login',domains:['workana.com'],loginPattern:/login|signin/i},
  n8n:{label:'n8n Community',home:'https://community.n8n.io/latest',login:'https://community.n8n.io/login',domains:['community.n8n.io'],loginPattern:/\/login/i,forum:true},
  make:{label:'Make Community',home:'https://community.make.com/latest',login:'https://community.make.com/login',domains:['community.make.com'],loginPattern:/\/login/i,forum:true},
  contra:{label:'Contra',home:'https://contra.com/opportunities',login:'https://contra.com/login',domains:['contra.com'],loginPattern:/login|sign-in/i},
  wellfound:{label:'Wellfound',home:'https://wellfound.com/jobs',login:'https://wellfound.com/login',domains:['wellfound.com'],loginPattern:/login/i},
  twine:{label:'Twine',home:'https://www.twine.net/jobs',login:'https://www.twine.net/signin',domains:['twine.net'],loginPattern:/signin|login/i},
  guru:{label:'Guru',home:'https://www.guru.com/d/jobs/',login:'https://www.guru.com/login.aspx',domains:['guru.com'],loginPattern:/login/i},
  malt:{label:'Malt',home:'https://www.malt.com/',login:'https://www.malt.com/login',domains:['malt.com'],loginPattern:/login/i},
  peopleperhour:{label:'PeoplePerHour',home:'https://www.peopleperhour.com/freelance-jobs',login:'https://www.peopleperhour.com/site/login',domains:['peopleperhour.com'],loginPattern:/login/i},
}

export const browserPlatforms=Object.keys(PLATFORM_CONFIG)

const bytesToB64=bytes=>{
  let s=''
  for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i])
  return btoa(s)
}
const b64ToBytes=s=>{
  const raw=atob(s);const out=new Uint8Array(raw.length)
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i)
  return out
}
async function cryptoKey(env){
  if(!env.BROWSER_SESSION_KEY)throw new Error('browser_session_key_missing')
  const raw=b64ToBytes(env.BROWSER_SESSION_KEY)
  if(raw.length!==32)throw new Error('browser_session_key_invalid')
  return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt'])
}
async function seal(env,value){
  const iv=crypto.getRandomValues(new Uint8Array(12))
  const key=await cryptoKey(env)
  const data=enc.encode(JSON.stringify(value))
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,data))
  return JSON.stringify({v:1,iv:bytesToB64(iv),cipher:bytesToB64(cipher)})
}
async function unseal(env,payload){
  const x=JSON.parse(payload||'{}')
  if(x.v!==1||!x.iv||!x.cipher)throw new Error('browser_session_payload_invalid')
  const key=await cryptoKey(env)
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(x.iv)},key,b64ToBytes(x.cipher))
  return JSON.parse(dec.decode(plain))
}
function cfg(platform){
  const key=String(platform||'').toLowerCase().replace(/[^a-z0-9]/g,'')
  const aliases={peopleperhour:'peopleperhour',pph:'peopleperhour',linkedin:'linkedin',upwork:'upwork',workana:'workana',n8n:'n8n',make:'make',contra:'contra',wellfound:'wellfound',twine:'twine',guru:'guru',malt:'malt'}
  const id=aliases[key]
  if(!id||!PLATFORM_CONFIG[id])throw new Error('unsupported_platform')
  return {id,...PLATFORM_CONFIG[id]}
}
async function setting(env,key,value){
  await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
    .bind(key,typeof value==='string'?value:JSON.stringify(value),Date.now()).run().catch(()=>{})
}
export async function saveBrowserState(env,platform,state,meta={}){
  if(!env.BROWSER_SESSIONS)throw new Error('browser_sessions_binding_missing')
  const p=cfg(platform)
  const record={platform:p.id,label:p.label,state,savedAt:Date.now(),...meta}
  await env.BROWSER_SESSIONS.put('session:'+p.id,await seal(env,record))
  await setting(env,'browser_session:'+p.id,{status:'saved',savedAt:record.savedAt,lastUrl:meta.lastUrl||null})
  return {platform:p.id,status:'saved',savedAt:record.savedAt}
}
export async function loadBrowserState(env,platform){
  if(!env.BROWSER_SESSIONS)return null
  const p=cfg(platform)
  const raw=await env.BROWSER_SESSIONS.get('session:'+p.id)
  if(!raw)return null
  try{return await unseal(env,raw)}catch{return null}
}
export async function browserSessionSummary(env){
  const out=[]
  for(const id of browserPlatforms){
    const saved=await loadBrowserState(env,id)
    let meta=null
    try{const row=await env.DB.prepare('SELECT value FROM app_settings WHERE key=?').bind('browser_session:'+id).first();meta=row?JSON.parse(row.value):null}catch{}
    out.push({platform:id,label:PLATFORM_CONFIG[id].label,saved:!!saved,status:meta?.status|| (saved?'saved':'missing'),lastChecked:meta?.lastChecked||null,lastUrl:meta?.lastUrl||null})
  }
  return out
}

export async function createBrowserSetup(env,platform){
  if(!env.BROWSER||!env.BROWSER_SESSIONS)throw new Error('browser_binding_missing')
  const p=cfg(platform)
  const browser=await launch(env.BROWSER,{keep_alive:1200000})
  const context=await browser.newContext()
  const page=await context.newPage()
  await page.goto(p.login,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{})
  const cdp=await context.newCDPSession(page)
  const live=await cdp.send('Cloudflare.getLiveView',{mode:'tab',expiresInMs:3600000})
  await cdp.send('Cloudflare.handoff',{targetId:live.id,instructions:`Inicia sesión en ${p.label}. Completa MFA/CAPTCHA si aparece. No cambies otras configuraciones. Cuando veas tu cuenta abierta, vuelve a la primera pestaña y pulsa Guardar sesión.`,timeout:3600000}).catch(()=>null)
  const token=crypto.randomUUID().replace(/-/g,'')
  const setup={platform:p.id,sessionId:browser.sessionId(),targetId:live.id,createdAt:Date.now()}
  await env.BROWSER_SESSIONS.put('setup:'+token,await seal(env,setup),{expirationTtl:7200})
  await setting(env,'browser_session:'+p.id,{status:'setup_waiting_human',setupAt:Date.now()})
  return {platform:p.id,label:p.label,token,liveViewUrl:live.devtoolsFrontendUrl,expiresInSeconds:3600}
}

export async function finishBrowserSetup(env,token){
  if(!env.BROWSER||!env.BROWSER_SESSIONS)throw new Error('browser_binding_missing')
  const raw=await env.BROWSER_SESSIONS.get('setup:'+String(token||''))
  if(!raw)throw new Error('setup_token_expired')
  const setup=await unseal(env,raw)
  const p=cfg(setup.platform)
  const browser=await connect(env.BROWSER,{sessionId:setup.sessionId})
  const contexts=browser.contexts()
  const context=contexts[0]||await browser.newContext()
  const pages=context.pages()
  const page=pages[0]||await context.newPage()
  const url=page.url()
  if(p.loginPattern.test(url))throw new Error('still_on_login_page')
  const state=await context.storageState()
  await saveBrowserState(env,p.id,state,{lastUrl:url})
  await env.BROWSER_SESSIONS.delete('setup:'+String(token||''))
  await browser.close().catch(()=>{})
  return {platform:p.id,status:'saved',lastUrl:url}
}

async function classifyPage(page,p){
  const url=page.url()
  const title=await page.title().catch(()=>'')
  const body=(await page.locator('body').innerText({timeout:5000}).catch(()=>'' )).slice(0,5000)
  if(p.loginPattern.test(url)||/sign in|log in|iniciar sesi[oó]n|acceder a tu cuenta/i.test(body)&&/password|contrase/i.test(body))return {status:'expired',url,title}
  if(/captcha|verify you are human|security check|checkpoint|unusual activity/i.test(body))return {status:'human_required',url,title}
  return {status:'ready',url,title}
}
export async function checkBrowserSession(env,platform,{persistFresh=true}={}){
  const p=cfg(platform)
  const saved=await loadBrowserState(env,p.id)
  if(!saved?.state)return {platform:p.id,status:'missing'}
  if(!env.BROWSER)return {platform:p.id,status:'browser_binding_missing'}
  let browser
  try{
    browser=await launch(env.BROWSER,{keep_alive:120000})
    const context=await browser.newContext({storageState:saved.state})
    const page=await context.newPage()
    await page.goto(p.home,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{})
    await page.waitForTimeout(1200)
    const result=await classifyPage(page,p)
    if(result.status==='ready'&&persistFresh){
      const state=await context.storageState()
      await saveBrowserState(env,p.id,state,{lastUrl:result.url,lastChecked:Date.now()})
    }
    await setting(env,'browser_session:'+p.id,{...result,lastChecked:Date.now(),savedAt:saved.savedAt||null})
    return {platform:p.id,label:p.label,...result}
  }catch(e){
    const result={platform:p.id,label:p.label,status:'error',error:String(e?.message||e).slice(0,300)}
    await setting(env,'browser_session:'+p.id,{...result,lastChecked:Date.now()})
    return result
  }finally{if(browser)await browser.close().catch(()=>{})}
}

export async function runBrowserSessionHealth(env){
  if(!env.BROWSER_AUTOMATION_ENABLED||env.BROWSER_AUTOMATION_ENABLED!=='true')return {enabled:false}
  const idxRow=await env.DB.prepare("SELECT value FROM app_settings WHERE key='browser_health_index'").first().catch(()=>null)
  const idx=(Number(idxRow?.value||0)||0)%browserPlatforms.length
  const platform=browserPlatforms[idx]
  const saved=await loadBrowserState(env,platform)
  let result={platform,status:'missing'}
  if(saved)result=await checkBrowserSession(env,platform)
  await setting(env,'browser_health_index',String((idx+1)%browserPlatforms.length))
  return result
}

function normalizePlatform(v=''){
  const x=String(v).toLowerCase()
  if(x.includes('linkedin'))return 'linkedin'
  if(x.includes('upwork'))return 'upwork'
  if(x.includes('workana'))return 'workana'
  if(x.includes('n8n'))return 'n8n'
  if(x.includes('make'))return 'make'
  if(x.includes('contra'))return 'contra'
  if(x.includes('wellfound'))return 'wellfound'
  if(x.includes('twine'))return 'twine'
  if(x.includes('guru'))return 'guru'
  if(x.includes('malt'))return 'malt'
  if(x.includes('peopleperhour')||x.includes('people per hour')||x==='pph')return 'peopleperhour'
  return null
}
async function upsertSubmission(env,row,{platform,status,route='browser',providerId=null,error=null}){
  const now=Date.now()
  await env.DB.prepare(`INSERT INTO direct_applications(source_url,platform,route,status,subject,body,provider_id,error,sent_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(source_url) DO UPDATE SET platform=excluded.platform,route=excluded.route,status=excluded.status,subject=excluded.subject,body=excluded.body,provider_id=excluded.provider_id,error=excluded.error,sent_at=excluded.sent_at,updated_at=excluded.updated_at`)
    .bind(row.url,platform,route,status,String(row.who||row.need||'').slice(0,300),String(row.reply||'').slice(0,8000),providerId,error,status==='sent'?now:null,now,now).run().catch(()=>{})
}
async function submitDiscourse(env,row,platform){
  const p=cfg(platform)
  const saved=await loadBrowserState(env,platform)
  if(!saved?.state)return {status:'missing_session'}
  let browser
  try{
    browser=await launch(env.BROWSER,{keep_alive:120000})
    const context=await browser.newContext({storageState:saved.state})
    const page=await context.newPage()
    await page.goto(row.url,{waitUntil:'domcontentloaded',timeout:30000})
    await page.waitForTimeout(1200)
    const state=await classifyPage(page,p)
    if(state.status!=='ready')return state
    const body=(await page.locator('body').innerText({timeout:5000}).catch(()=>'' )).slice(0,10000)
    if(/topic (?:has been |is )?closed|este tema.*cerrado|you cannot reply|no puedes responder/i.test(body))return {status:'closed'}
    let replyButton=page.getByRole('button',{name:/^(reply|responder)$/i}).last()
    if(!(await replyButton.count())) replyButton=page.locator('button.reply-to-post, .topic-footer-main-buttons button.reply').last()
    if(!(await replyButton.count()))return {status:'waiting_human',reason:'reply_button_not_found'}
    await replyButton.click()
    const editor=page.locator('textarea.d-editor-input, textarea').last()
    await editor.waitFor({state:'visible',timeout:8000})
    const proposal=String(row.reply||'').trim()
    if(proposal.length<40)return {status:'waiting_human',reason:'proposal_missing'}
    await editor.fill(proposal)
    let submit=page.getByRole('button',{name:/^(reply|responder)$/i}).last()
    if(!(await submit.count()))submit=page.locator('button.btn-primary.create, button.create').last()
    if(!(await submit.count()))return {status:'waiting_human',reason:'submit_button_not_found'}
    await submit.click()
    await page.waitForTimeout(1800)
    const after=(await page.locator('body').innerText({timeout:5000}).catch(()=>'' )).slice(-12000)
    const proof=proposal.slice(0,45).replace(/\s+/g,' ')
    if(!after.replace(/\s+/g,' ').includes(proof.slice(0,30)))return {status:'waiting_human',reason:'submission_confirmation_missing'}
    const providerId=`browser:${platform}:${Date.now()}`
    await env.DB.prepare("UPDATE intent_leads SET status='submitted' WHERE url=?").bind(row.url).run().catch(()=>{})
    await upsertSubmission(env,row,{platform,status:'sent',route:'browser_forum',providerId})
    const fresh=await context.storageState();await saveBrowserState(env,platform,fresh,{lastUrl:page.url(),lastChecked:Date.now()})
    await notifyCatalina(env,`✅ Carolina publicó en ${p.label}`,`${row.who||row.need||'Oportunidad'}\n\n${row.url}\n\nEvidencia: ${providerId}`).catch(()=>{})
    return {status:'submitted',providerId,url:page.url()}
  }catch(e){return {status:'error',error:String(e?.message||e).slice(0,300)}}finally{if(browser)await browser.close().catch(()=>{})}
}

async function inspectPlatformApplication(env,row,platform){
  const p=cfg(platform)
  const saved=await loadBrowserState(env,platform)
  if(!saved?.state)return {status:'missing_session'}
  let browser
  try{
    browser=await launch(env.BROWSER,{keep_alive:120000})
    const context=await browser.newContext({storageState:saved.state})
    const page=await context.newPage()
    await page.goto(row.url,{waitUntil:'domcontentloaded',timeout:30000})
    await page.waitForTimeout(1200)
    const state=await classifyPage(page,p)
    if(state.status!=='ready')return state
    const text=(await page.locator('body').innerText({timeout:5000}).catch(()=>'' )).slice(0,12000)
    let action='unknown'
    if(platform==='linkedin'&&/easy apply|solicitud sencilla/i.test(text))action='easy_apply_available'
    else if(platform==='upwork'&&/submit a proposal|apply now|enviar una propuesta/i.test(text))action='proposal_available'
    else if(platform==='workana'&&/enviar propuesta|postular|send proposal/i.test(text))action='proposal_available'
    else if(/apply|postular|submit proposal|send proposal/i.test(text))action='application_available'
    const questions=[...text.matchAll(/(?:required|obligatorio|question|pregunta)[^\n]{0,160}/gi)].slice(0,8).map(x=>x[0])
    await upsertSubmission(env,row,{platform,status:'waiting_human_form',route:'browser_prefill',error:action})
    return {status:'waiting_human_form',action,questions,url:page.url()}
  }catch(e){return {status:'error',error:String(e?.message||e).slice(0,300)}}finally{if(browser)await browser.close().catch(()=>{})}
}

export async function runBrowserApplicationQueue(env,{limit=2}={}){
  if(env.BROWSER_AUTOMATION_ENABLED!=='true'||!env.BROWSER)return {enabled:false}
  const rows=(await env.DB.prepare(`SELECT i.url,i.platform,i.who,i.need,i.fit,i.reply,i.status
    FROM intent_leads i LEFT JOIN direct_applications d ON d.source_url=i.url
    WHERE i.fit='alto' AND i.status IN ('application_ready','waiting_human_submit','waiting_human_form','waiting_human_channel','needs_application_review')
      AND coalesce(d.status,'') NOT IN ('sent','external_email_sent','replied','not_hiring')
    ORDER BY i.found_at DESC LIMIT 25`).all()).results||[]
  const results=[]
  for(const row of rows){
    if(results.length>=limit)break
    const platform=normalizePlatform(row.platform)
    if(!platform)continue
    const saved=await loadBrowserState(env,platform)
    if(!saved)continue
    let result
    if(platform==='n8n'||platform==='make')result=await submitDiscourse(env,row,platform)
    else result=await inspectPlatformApplication(env,row,platform)
    results.push({platform,url:row.url,...result})
    if(result.status==='expired'||result.status==='human_required'){
      await setting(env,'browser_session:'+platform,{status:result.status,lastChecked:Date.now(),lastUrl:result.url||row.url})
      await notifyCatalina(env,`🔐 Carolina necesita reautenticar ${PLATFORM_CONFIG[platform].label}`,`La sesión cloud ya no permite continuar. Carolina conservó la oportunidad y no la marcó como enviada.\n\n${row.url}`).catch(()=>{})
    }
  }
  return {enabled:true,processed:results.length,results}
}
