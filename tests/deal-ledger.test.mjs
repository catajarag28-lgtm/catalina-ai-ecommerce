import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCommercialDeal } from '../worker/core/dealLedger.js';

const deal={dealRef:'contract-123',client:'Example Co',channel:'partnerships',evidenceRef:'signed-contract-123',signedAmountUsd:5000,signedAt:'2026-10-09T12:00:00Z'};

test('signed amount and collected deposit stay separate',()=>{
  const d=cleanCommercialDeal({...deal,depositAmountUsd:1500,depositReceivedAt:'2026-10-09T13:00:00Z'});
  assert.equal(d.signedAmountUsd,5000);
  assert.equal(d.depositAmountUsd,1500);
});

test('no deposit is counted without receipt date or evidence',()=>{
  assert.throws(()=>cleanCommercialDeal({...deal,depositAmountUsd:1500}),/invalid_dates/);
  assert.throws(()=>cleanCommercialDeal({...deal,evidenceRef:''}),/evidence/);
  assert.throws(()=>cleanCommercialDeal({...deal,depositAmountUsd:6000,depositReceivedAt:'2026-10-09T13:00:00Z'}),/invalid_amount/);
});
