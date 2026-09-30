import test from 'node:test'
import assert from 'node:assert/strict'
import {availability,book,researchWebsite,sendEmail} from '../worker/core/integrations.js'

const env={GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret',GOOGLE_REFRESH_TOKEN:'refresh',GOOGLE_CALENDAR_ID:'primary',CALENDAR_TIMEZONE:'America/Bogota',DB:{prepare(){return {bind(){return {run:async()=>({})}}}}}}
const futureDay=()=>new Date(Date.now()+3*86400000).toISOString().slice(0,10)

test('Calendar reports missing credentials instead of inventing slots',async()=>{
 assert.deepEqual(await availability({},futureDay()),{ok:false,reason:'calendar_unavailable'})
})

test('Calendar returns actual free slots and refuses an unconfirmed event',async()=>{
 const original=globalThis.fetch
 globalThis.fetch=async url=>{
  if(String(url).includes('oauth2.googleapis.com'))return Response.json({access_token:'token'})
  if(String(url).includes('freeBusy'))return Response.json({calendars:{primary:{busy:[]}}})
  return new Response('upstream error',{status:500})
 }
 try{
  const slots=await availability(env,futureDay())
  assert.equal(slots.ok,true)
  assert.equal(slots.slots.length,6)
  const result=await book(env,{start:slots.slots[0],email:'prospecto@example.com',name:'Prospecto'},'conversation-id')
  assert.deepEqual(result,{ok:false,reason:'calendar_create_failed'})
 }finally{globalThis.fetch=original}
})

test('Email does not claim delivery without provider configuration',async()=>{
 assert.deepEqual(await sendEmail({},'person@example.com','Hola','Texto'),{ok:false,reason:'email_unavailable'})
})

test('Public research rejects local and non-HTTPS URLs',async()=>{
 assert.equal((await researchWebsite('http://example.com')).ok,false)
 assert.equal((await researchWebsite('https://localhost')).ok,false)
 assert.equal((await researchWebsite('https://192.168.1.1')).ok,false)
})
