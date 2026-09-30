import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyResendSignature, receiveResendEvent } from '../worker/engagement.js'
import { brandedProposal } from '../worker/outreach.js'

test('Resend events require an intact signed body and recent timestamp', async () => {
    const secret='whsec_'+btoa('a reproducible test secret')
    const body=JSON.stringify({type:'email.delivered',data:{email_id:'test'}})
    const id='msg_test'
    const timestamp=String(Math.floor(Date.now()/1000))
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('a reproducible test secret'),{name:'HMAC',hash:'SHA-256'},false,['sign'])
    const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(id+'.'+timestamp+'.'+body)))
    const signature='v1,'+btoa(String.fromCharCode(...digest))
    const headers=new Headers({'svix-id':id,'svix-timestamp':timestamp,'svix-signature':signature})
    assert.equal(await verifyResendSignature(body,headers,secret),true)
    assert.equal(await verifyResendSignature(body+' ',headers,secret),false)
    assert.equal(await verifyResendSignature(body,headers,secret,Date.now()+3600000),false)
})
test('A verified bounce is recorded once and suppresses future contact', async () => {
  const secret='whsec_'+btoa('another reproducible secret')
  const payload=JSON.stringify({type:'email.bounced',created_at:new Date().toISOString(),data:{email_id:'provider-1'}})
  const id='webhook-once'
  const timestamp=String(Math.floor(Date.now()/1000))
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('another reproducible secret'),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(id+'.'+timestamp+'.'+payload)))
  const headers={'svix-id':id,'svix-timestamp':timestamp,'svix-signature':'v1,'+btoa(String.fromCharCode(...digest))}
  const writes=[]
  const seen=new Set()
  const env={RESEND_WEBHOOK_SECRET:secret,DB:{prepare(sql){return {bind(...args){return {async first(){return {id:'row-1',email:'owned@example.test',status:'sent'}},async run(){writes.push({sql,args});if(sql.startsWith('INSERT OR IGNORE')){if(seen.has(args[0]))return {meta:{changes:0}};seen.add(args[0])}return {meta:{changes:1}}}}}}}}}
  const make=()=>new Request('https://soycatalinajaramillo.com/webhooks/resend',{method:'POST',headers,body:payload})
  assert.equal((await receiveResendEvent(make(),env)).status,200)
  assert.equal((await receiveResendEvent(make(),env)).status,200)
  assert.equal(writes.filter(x=>x.sql.startsWith('INSERT OR REPLACE INTO suppression')).length,1)
  assert.equal(writes.find(x=>x.sql.startsWith('UPDATE outreach SET status='))?.args[0],'bounced')
})