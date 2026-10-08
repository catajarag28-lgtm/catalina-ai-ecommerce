import test from 'node:test'
import assert from 'node:assert/strict'
import { receiveResendEvent } from '../worker/proposals/engagement.js'

test('Resend delivery and bounce for a direct application are separate and idempotent', async () => {
  const secret='whsec_'+btoa('direct application webhook secret')
  const events=[]
  const updates=[]
  const seen=new Set()
  const env={RESEND_WEBHOOK_SECRET:secret,DB:{prepare(sql){return {
    bind(...args){return {
      async first(){if(sql.includes('FROM outreach'))return null;if(sql.includes('FROM direct_applications'))return {source_url:'https://example.test/job',recipient:'jobs@example.test'};return null},
      async run(){updates.push({sql,args});if(sql.includes('INSERT OR IGNORE INTO direct_application_events')){if(seen.has(args[0]))return {meta:{changes:0}};seen.add(args[0]);events.push(args)}return {meta:{changes:1}}}
    }},async run(){updates.push({sql,args:[]});return {meta:{changes:1}}}
  }}}}
  async function post(type,id){
    const body=JSON.stringify({type,created_at:new Date().toISOString(),data:{email_id:'resend-123'}})
    const timestamp=String(Math.floor(Date.now()/1000))
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('direct application webhook secret'),{name:'HMAC',hash:'SHA-256'},false,['sign'])
    const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(id+'.'+timestamp+'.'+body)))
    const headers={'svix-id':id,'svix-timestamp':timestamp,'svix-signature':'v1,'+btoa(String.fromCharCode(...digest))}
    return receiveResendEvent(new Request('https://soycatalinajaramillo.com/webhooks/resend',{method:'POST',headers,body}),env)
  }
  assert.equal((await post('email.delivered','delivery-1')).status,200)
  assert.equal((await post('email.delivered','delivery-1')).status,200)
  assert.equal(events.length,1)
  assert.equal(events[0][2],'email.delivered')
  assert.equal(updates.filter(x=>x.sql.includes('UPDATE direct_applications')).length,0)
  assert.equal((await post('email.bounced','bounce-1')).status,200)
  assert.equal(updates.find(x=>x.sql.includes('UPDATE direct_applications'))?.args[0],'bounced')
  assert.equal(updates.find(x=>x.sql.includes('INTO suppression'))?.args[0],'jobs@example.test')
})
