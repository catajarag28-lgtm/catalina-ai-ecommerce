import test from 'node:test'
import assert from 'node:assert/strict'
import { brandedProposal, runOutreach } from '../worker/outreach.js'
import { researchWebsite } from '../worker/integrations.js'
const p={offer:'ventas',observation:'Tienen citas en línea.',hypothesis:'Si las consultas fuera de horario esperan, podemos validar un asistente.',solution:'Calificación, agenda y traspaso al equipo.'}
test('First email escapes external content and withholds pricing',()=>{
 const html=brandedProposal('<img onerror=alert(1)>',{...p,solution:'<script>bad()</script>'})
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img onerror'))
 assert.ok(!html.includes('3.800'));assert.ok(!html.includes('490/mes'));assert.ok(html.includes('BAJA'))
 assert.throws(()=>brandedProposal('Spa',{...p,offer:'diagnostico'}))
})
test('No enabled outreach or missing connections performs no send',async()=>{
 assert.deepEqual(await runOutreach({}),{enabled:false})
 assert.deepEqual(await runOutreach({OUTREACH_ENABLED:'true'}),{reason:'connections_missing'})
})
test('Email verification is grounded in actual HTML, not model output',async()=>{
 const original=globalThis.fetch
 globalThis.fetch=async()=>new Response('<h1>Spa</h1><a href="mailto:Info@spa.example">Correo</a><a href="https://spa.example/contact">Contacto</a>',{headers:{'content-type':'text/html'}})
 try{const r=await researchWebsite('https://spa.example');assert.deepEqual(r.publicEmails,['info@spa.example']);assert.ok(r.publicLinks.includes('https://spa.example/contact'))}finally{globalThis.fetch=original}
})

import {outreachDailyLimit,schedulingUrl,meetingNextStep} from '../worker/salesStrategy.js'
test('Volume grows only when configured and cannot exceed 50',()=>{
 assert.equal(outreachDailyLimit({}),5)
 assert.equal(outreachDailyLimit({OUTREACH_DAILY_LIMIT:'30'}),30)
 assert.equal(outreachDailyLimit({OUTREACH_DAILY_LIMIT:'100'}),50)
 assert.equal(outreachDailyLimit({OUTREACH_DAILY_LIMIT:'invalid'}),5)
})
test('Appointment links must be Google HTTPS; missing connection never claims booking',()=>{
 assert.equal(schedulingUrl({GOOGLE_BOOKING_URL:'https://calendar.google.com.evil.example/'}),null)
 assert.equal(schedulingUrl({GOOGLE_BOOKING_URL:'javascript:alert(1)'}),null)
 assert.ok(meetingNextStep({}).includes('pendiente'))
 assert.ok(meetingNextStep({GOOGLE_BOOKING_URL:'https://calendar.app.google/example'}).includes('https://calendar.app.google/example'))
})
