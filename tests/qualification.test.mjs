import test from 'node:test'
import assert from 'node:assert/strict'
import {qualificationStatus} from '../worker/core/qualification.js'

test('problem without contact',()=>{ assert.equal(qualificationStatus('qualified','exploring',{business:'Clinica',declaredProblem:'WhatsApp sin respuesta'}),'identified') })
test('need with contact may qualify',()=>{ assert.equal(qualificationStatus('qualified','exploring',{business:'Tienda online',desiredOutcomes:'recuperar carritos',email:'owner@example.com',urgency:'este mes'}),'qualified') })
test('contact and urgency may qualify',()=>{ assert.equal(qualificationStatus('qualified','identified',{business:'Clinica',declaredProblem:'WhatsApp sin respuesta',email:'owner@example.com',urgency:'este mes'}),'qualified') })
test('high intent needs acceptance',()=>{ const lead={business:'Clinica',goal:'Agendar',email:'owner@example.com',budget:'USD 3000'}; assert.equal(qualificationStatus('high_intent','qualified',lead),'qualified'); assert.equal(qualificationStatus('high_intent','qualified',{...lead,intent:'Quiero agendar reunion'}),'high_intent') })

