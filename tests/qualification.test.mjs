import test from 'node:test'
import assert from 'node:assert/strict'
import {qualificationStatus} from '../worker/qualification.js'

test('A business problem without contact cannot be qualified',()=>{
 assert.equal(qualificationStatus('qualified','exploring',{business:'Clínica',declaredProblem:'WhatsApp sin respuesta',volume:'40 por semana'}),'identified')
})
test('A concrete prospect with contact and urgency may be qualified',()=>{
 assert.equal(qualificationStatus('qualified','identified',{business:'Clínica',declaredProblem:'WhatsApp sin respuesta',email:'owner@example.com',urgency:'este mes'}),'qualified')
})
test('High intent needs an explicit acceptance or meeting intent',()=>{
 const lead={business:'Clínica',goal:'Agendar',email:'owner@example.com',budget:'USD 3000'}
 assert.equal(qualificationStatus('high_intent','qualified',lead),'qualified')
 assert.equal(qualificationStatus('high_intent','qualified',{...lead,intent:'Quiero agendar reunión'}),'high_intent')
})
