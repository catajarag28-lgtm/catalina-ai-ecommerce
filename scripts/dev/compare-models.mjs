// Uso: OPENROUTER_API_KEY=... node scripts/compare-models.mjs model/a model/b
const key=process.env.OPENROUTER_API_KEY
if(!key){console.error('Define OPENROUTER_API_KEY localmente. No la incluyas en argumentos ni en Git.');process.exit(1)}
const models=process.argv.slice(2)
if(!models.length){console.error('Indica al menos un slug de OpenRouter.');process.exit(1)}
const prompt='Soy dueño de una clínica. Quiero que un agente contacte pacientes y gestione citas. Explica qué explorarías primero, plantea una solución probable y haz una sola pregunta pertinente. No inventes métricas.'
for(const model of models){
 const started=Date.now()
 const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:'Eres Carolina, asesora empresarial. Responde en español sin prometer resultados.'},{role:'user',content:prompt}],max_tokens:450,temperature:.45})})
 const body=await res.json()
 console.log(JSON.stringify({model,ok:res.ok,latencyMs:Date.now()-started,usage:body.usage||null,reply:body.choices?.[0]?.message?.content||null,error:body.error?.message||null},null,2))
}
