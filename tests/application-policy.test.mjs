import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldKind, pageBlocker, freshEnough } from '../vm/application-policy.js';

test('proposal field is explicit and salary needs a human answer',()=>{
  assert.equal(fieldKind('Cover letter'), 'proposal');
  assert.equal(fieldKind('Propuesta para el cliente'), 'proposal');
  assert.equal(fieldKind('Expected salary'), 'human');
  assert.equal(fieldKind('Describe a project you delivered'), 'unknown');
});

test('closed and paid routes stop the application',()=>{
  assert.equal(pageBlocker('This job is no longer available'), 'opportunity_closed');
  assert.equal(pageBlocker('Purchase Connects to apply'), 'payment_required');
  assert.equal(pageBlocker('Send proposal'), null);
});

test('unknown publication date and stale posts do not consume VM capacity',()=>{
  const now=Date.parse('2026-10-09T15:00:00Z');
  assert.equal(freshEnough({platform:'n8n community',publishedAt:'2026-10-08T15:00:00Z'},now), true);
  assert.equal(freshEnough({platform:'n8n community',publishedAt:'2026-09-01T15:00:00Z'},now), false);
  assert.equal(freshEnough({platform:'ATS',publishedAt:'2026-08-01T15:00:00Z'},now), false);
  assert.equal(freshEnough({platform:'ATS'},now), false);
});
