// Fuente pública de proyectos con intención explícita; no requiere scraping de cuentas.
const BASE='https://community.n8n.io';
const BUYER=/(hiring|looking\s+for|need\s+(?:someone|a\s+freelancer|an?\s+expert)|seeking|buscamos|busco|necesitamos|freelancer\s+required|paid\s+project)/i;
const SELLER=/(?:^|\[)(?:for\s+hire|open\s+to\s+work)|available\s+for\s+hire/i;
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();

export async function fetchN8nJobs({fetcher=fetch,now=Date.now(),limit=5}={}) {
  const get=async url=>{
    const r=await fetcher(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(10000)}).catch(()=>null);
    return r?.ok?r.json().catch(()=>null):null;
  };
  const category=await get(BASE+'/c/jobs/13.json');
  const topics=(category?.topic_list?.topics||[])
    .filter(t=>!t.closed&&!t.archived&&BUYER.test(t.title||'')&&!SELLER.test(t.title||'')&&!/(co[ -]?founder|german speaking|unpaid|equity.only)/i.test(t.title||''))
    .filter(t=>{const at=Date.parse(t.created_at||'');return Number.isFinite(at)&&now-at<=21*86400000&&at<=now+86400000})
    .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))
    .slice(0,20);
  const found=[];
  for(const t of topics){
    const url=BASE+'/t/'+encodeURIComponent(t.slug)+'/'+t.id;
    const detail=await get(BASE+'/t/'+t.id+'.json');
    const post=detail?.post_stream?.posts?.[0];
    const body=clean(post?.cooked||post?.raw);
    if(!body || !BUYER.test(t.title+' '+body)) continue;
    if(/\bfull[ -]?time\b/i.test(body)&&!/\b(freelance|contract|project.based|por proyectos|por proyecto)\b/i.test(body)) continue;
    const email=body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]||null;
    found.push({url,platform:'n8n community',title:t.title,who:post?.username||'buyer',need:body.slice(0,400),evidence:body.slice(0,280),date:t.created_at,kind:'project',applicationRoute:email?'email':'community',language:/\b(busco|buscamos|necesitamos|proyecto|automatizaci[oó]n)\b/i.test(t.title+' '+body)?'es':'en',activeNow:true});
    if(found.length>=Math.max(1,Math.min(12,limit))) break;
  }
  return found;
}
