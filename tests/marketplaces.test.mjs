import test from 'node:test'
import assert from 'node:assert/strict'
import { freelancerReady, freelancerBidAllowance, upworkReady } from '../worker/prospecting/marketplaces.js'

test('Freelancer autosubmit requires explicit enablement and OAuth token',()=>{
  assert.equal(freelancerReady({}),false)
  assert.equal(freelancerReady({MARKETPLACE_AUTOSUBMIT_ENABLED:'true'}),false)
  assert.equal(freelancerReady({MARKETPLACE_AUTOSUBMIT_ENABLED:'true',FREELANCER_BID_SCOPE_VERIFIED:'true',FREELANCER_OAUTH_TOKEN:'token'}),true)
  assert.equal(freelancerReady({MARKETPLACE_AUTOSUBMIT_ENABLED:'false',FREELANCER_OAUTH_TOKEN:'token'}),false)
})

test('Upwork autosubmit remains off until token and Submit Proposal permission are explicitly enabled',()=>{
  assert.equal(upworkReady({MARKETPLACE_AUTOSUBMIT_ENABLED:'true',UPWORK_ACCESS_TOKEN:'token'}),false)
  assert.equal(upworkReady({MARKETPLACE_AUTOSUBMIT_ENABLED:'true',UPWORK_ACCESS_TOKEN:'token',UPWORK_SUBMIT_PROPOSAL_ENABLED:'true'}),false)
  assert.equal(upworkReady({MARKETPLACE_AUTOSUBMIT_ENABLED:'true',UPWORK_ACCESS_TOKEN:'token',UPWORK_SUBMIT_PROPOSAL_ENABLED:'true',UPWORK_ADAPTER_READY:'true'}),true)
})

test('Freelancer unlocks normal bid capacity after a verified provider submission',()=>{
  const env={FREELANCER_DAILY_BID_LIMIT:'8'}
  assert.equal(freelancerBidAllowance(env,false),1)
  assert.equal(freelancerBidAllowance(env,true),8)
  assert.equal(freelancerBidAllowance({...env,FREELANCER_FIRST_BID_VERIFIED:'true'},true),8)
})
