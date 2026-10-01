import test from 'node:test'
import assert from 'node:assert/strict'
import { instagramReady, verifyInstagramSignature, parseInstagramEvents, verifyInstagramChallenge } from '../worker/core/instagram.js'

test('Instagram readiness requires the official credentials',()=>{
  assert.equal(instagramReady({INSTAGRAM_ENABLED:'true'}),false)
  assert.equal(instagramReady({
    INSTAGRAM_ENABLED:'true',
    INSTAGRAM_ACCESS_TOKEN:'token',
    INSTAGRAM_USER_ID:'123',
    INSTAGRAM_VERIFY_TOKEN:'verify',
    INSTAGRAM_APP_SECRET:'secret',
  }),true)
  assert.equal(instagramReady({
    INSTAGRAM_ENABLED:'false',
    INSTAGRAM_ACCESS_TOKEN:'token',
    INSTAGRAM_USER_ID:'123',
    INSTAGRAM_VERIFY_TOKEN:'verify',
    INSTAGRAM_APP_SECRET:'secret',
  }),false)
})

test('Instagram webhook signature is HMAC SHA-256 verified',async()=>{
  const body='{"object":"instagram","entry":[]}'
  const secret='super-secret'
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body)))
  const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')
  const headers=new Headers({'x-hub-signature-256':'sha256='+hex})
  assert.equal(await verifyInstagramSignature(body,headers,secret),true)
  assert.equal(await verifyInstagramSignature(body+'x',headers,secret),false)
})

test('Instagram event parser accepts inbound DMs and ignores echoes',()=>{
  const events=parseInstagramEvents({
    entry:[{messaging:[
      {sender:{id:'prospect-1'},recipient:{id:'business-1'},timestamp:123,message:{mid:'m1',text:'Hola, quiero automatizar mis citas'}},
      {sender:{id:'business-1'},recipient:{id:'prospect-1'},timestamp:124,message:{mid:'m2',text:'echo',is_echo:true}},
    ]}]
  },'business-1')
  assert.equal(events.length,1)
  assert.equal(events[0].type,'message')
  assert.equal(events[0].senderId,'prospect-1')
  assert.match(events[0].text,/automatizar/)
})

test('Instagram webhook verification challenge uses exact verify token',async()=>{
  const ok=verifyInstagramChallenge(new URL('https://x.test/webhooks/instagram?hub.mode=subscribe&hub.verify_token=abc&hub.challenge=777'),{INSTAGRAM_VERIFY_TOKEN:'abc'})
  assert.equal(ok.status,200)
  assert.equal(await ok.text(),'777')
  const bad=verifyInstagramChallenge(new URL('https://x.test/webhooks/instagram?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=777'),{INSTAGRAM_VERIFY_TOKEN:'abc'})
  assert.equal(bad.status,403)
})
