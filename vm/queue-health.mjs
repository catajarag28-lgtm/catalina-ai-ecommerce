// Diagnóstico de solo lectura: no modifica la cola ni envía postulaciones.
const base=String(process.env.CAROLINA_WORKER_BASE||'https://soycatalinajaramillo.com').replace(/\/$/,'');
const token=process.env.CAROLINA_VM_TOKEN;
if(!token) throw new Error('CAROLINA_VM_TOKEN missing');
const r=await fetch(base+'/ops/vm-queue?limit=500',{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
if(!r.ok) throw new Error('queue_http_'+r.status);
const q=await r.json();
if(q.source!=='worker_canonical_opportunities'||!Array.isArray(q.items)) throw new Error('invalid_queue');
const byPlatform={};
for(const item of q.items) byPlatform[item.platform]=(byPlatform[item.platform]||0)+1;
console.log(JSON.stringify({ok:true,count:q.count,byPlatform,withCreatedAt:q.items.filter(x=>Number(x.createdAt)>0).length,withProposal:q.items.filter(x=>String(x.proposal||'').trim().split(/\s+/).length>=80).length}));
