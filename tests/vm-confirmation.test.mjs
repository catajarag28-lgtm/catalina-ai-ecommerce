import test from 'node:test'
import assert from 'node:assert/strict'
import { verifiedVmStatus, mapVmResult } from '../worker/core/vmBridge.js'

test('VM cannot mark a submission sent without a confirmation identifier',()=>{
  const status=verifiedVmStatus('SUBMITTED_CONFIRMED','')
  assert.equal(status,'SUBMIT_CLICKED_UNCONFIRMED')
  assert.notEqual(mapVmResult(status).application,'sent')
  assert.equal(verifiedVmStatus('SUBMITTED_CONFIRMED','browser:lever:confirmation-123'),'SUBMITTED_CONFIRMED')
})
