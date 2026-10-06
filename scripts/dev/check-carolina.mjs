const api='https://carolina-portfolio-api.catajaragpyg.workers.dev'
const headers={origin:'https://catajarag28-lgtm.github.io','content-type':'application/json'}
const session=await fetch(`${api}/session`,{method:'POST',headers,body:JSON.stringify({consent:true})})
if(!session.ok)throw new Error(`session ${session.status}`)
const {conversationId}=await session.json()
for(const message of ['Tengo una clínica. Recibimos unas 40 consultas por semana en WhatsApp y el equipo tarda en responder. Quiero un agente que contacte pacientes.','Me gusta cómo conversas. ¿Podría tener una Carolina para mi clínica y cuánto costaría aproximadamente?']){
 const res=await fetch(`${api}/chat`,{method:'POST',headers,body:JSON.stringify({conversationId,message})})
 const body=await res.json()
 console.log(JSON.stringify({status:res.status,reply:body.reply||body.error},null,2))
 if(!res.ok)process.exitCode=1
}
