import test from 'node:test'
import assert from 'node:assert/strict'
import {availability,book} from '../worker/integrations.js'

const day=new Date(Date.now()+3*86400000).toISOString().slice(0,10)
const env={GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret',GOOGLE_REFRESH_TOKEN:'refresh',GOOGLE_CALENDAR_ID:'primary',RESEND_API_KEY:'test',EMAIL_FROM:'test@example.com',DB:{prepare(){return {bind(){return {run:async()=>({success:true})}}}}}}

test('Calendar API errors never become available slots',async()=>{
 const original=globalThis.fetch
 globalThis.fetch=async url=>String(url).includes('oauth2.googleapis.com')?Response.json({access_token:'token'}):Response.json({calendars:{primary:{errors:[{reason:'internalError'}],busy:[]}}})
 try{assert.deepEqual(await availability(env,day),{ok:false,reason:'calendar_error'})}finally{globalThis.fetch=original}
})

test('Confirmed Google event remains confirmed if confirmation email fails',async()=>{
 const original=globalThis.fetch
 globalThis.fetch=async url=>{
  if(String(url).includes('oauth2.googleapis.com'))return Response.json({access_token:'token'})
  if(String(url).includes('freeBusy'))return Response.json({calendars:{primary:{busy:[]}}})
  if(String(url).includes('/events?'))return Response.json({id:'real-google-event',status:'confirmed',htmlLink:'https://calendar.google.com/example'})
  throw new Error('email provider offline')
 }
 try{
  const slots=await availability(env,day)
  const result=await book(env,{start:slots.slots[0],name:'Test',email:'test@example.com'},'test-conversation')
  assert.equal(result.ok,true)
  assert.equal(result.calendarEventId,'real-google-event')
  assert.equal(result.recorded,true)
  assert.equal(result.confirmationEmailSent,false)
 }finally{globalThis.fetch=original}
})
