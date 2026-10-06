import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeVmResult, mapVmResult } from '../worker/core/vmBridge.js'

test('vm bridge normalizes unknown statuses to ERROR', () => {
  assert.equal(normalizeVmResult('ready_to_submit_dry_run'), 'READY_TO_SUBMIT_DRY_RUN')
  assert.equal(normalizeVmResult('invented-status'), 'ERROR')
})

test('dry-run never counts as submitted', () => {
  const r = mapVmResult('READY_TO_SUBMIT_DRY_RUN')
  assert.equal(r.application, 'ready_for_submission')
  assert.equal(r.intent, 'waiting_human_submit')
  assert.equal(r.terminal, 0)
})

test('only confirmed submission is terminal sent', () => {
  const r = mapVmResult('SUBMITTED_CONFIRMED')
  assert.equal(r.application, 'sent')
  assert.equal(r.intent, 'submitted')
  assert.equal(r.opportunity, 'submitted')
  assert.equal(r.terminal, 1)
})

test('login/challenge stays retryable and is never sent', () => {
  for (const s of ['WAITING_HUMAN_LOGIN','WAITING_HUMAN_BLOCKER']) {
    const r = mapVmResult(s)
    assert.equal(r.application, 'waiting_human_channel')
    assert.equal(r.terminal, 0)
  }
})
