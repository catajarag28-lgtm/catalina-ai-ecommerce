import assert from 'node:assert/strict'

const site='https://catajarag28-lgtm.github.io/catalina-ai-ecommerce/'
const api='https://carolina-portfolio-api.catajaragpyg.workers.dev'
const origin='https://catajarag28-lgtm.github.io'
const page=await fetch(site)
assert.equal(page.status,200,'production page')
const html=await page.text()
assert.match(html,/Catalina Jaramillo — Tu empresa puede funcionar mejor/)
const photo=await fetch(`${site}catalina.jpg`)
assert.equal(photo.status,200,'Catalina portrait')
assert.match(photo.headers.get('content-type')||'',/image/)
const avatar=await fetch(`${site}carolina-avatar.webp`)
assert.equal(avatar.status,200,'Carolina avatar')
assert.match(avatar.headers.get('content-type')||'',/image/)
const health=await fetch(`${api}/health`,{headers:{origin}})
assert.equal(health.status,200,'Worker health')
assert.equal(health.headers.get('access-control-allow-origin'),origin,'CORS')
const status=await health.json()
assert.equal(status.status,'ok')
const rejected=await fetch(`${api}/session`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({consent:false})})
assert.equal(rejected.status,400,'consent gate')
const session=await fetch(`${api}/session`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({consent:true})})
assert.equal(session.status,201,'D1 session')
const {conversationId}=await session.json()
assert.match(conversationId,/^[0-9a-f-]{36}$/i)
if(!status.modelReady){
 const unavailable=await fetch(`${api}/chat`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({conversationId,message:'Hola'})})
 assert.equal(unavailable.status,503,'honest model fallback')
}
const forbidden=await fetch(`${api}/session`,{method:'POST',headers:{origin:'https://example.com','content-type':'application/json'},body:'{}'})
assert.equal(forbidden.status,403,'origin restriction')
console.log(JSON.stringify({site,page:page.status,photo:photo.status,avatar:avatar.status,api:status,consent:rejected.status,session:session.status,forbidden:forbidden.status},null,2))
