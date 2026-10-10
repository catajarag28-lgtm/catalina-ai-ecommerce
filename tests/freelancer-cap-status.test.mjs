import test from 'node:test'
import assert from 'node:assert/strict'
import { freelancerBidAllowance, marketplaceSnapshot } from '../worker/prospecting/marketplaces.js'

test('Freelancer defaults to finite daily bid capacity after verified first bid', () => {
  assert.equal(freelancerBidAllowance({}, true), 8)
  assert.equal(freelancerBidAllowance({FREELANCER_DAILY_BID_LIMIT:''}, true), 8)
  assert.equal(freelancerBidAllowance({FREELANCER_DAILY_BID_LIMIT:'12'}, true), 12)
  assert.equal(freelancerBidAllowance({FREELANCER_DAILY_BID_LIMIT:'999'}, true), 30)
  assert.equal(freelancerBidAllowance({FREELANCER_DAILY_BID_LIMIT:'-1'}, true), 8)
  assert.equal(freelancerBidAllowance({}, false), 1)
})

test('Marketplace health distinguishes token configuration from account bid exhaustion', async () => {
  const until = new Date(Date.now()+3600000).toISOString()
  const env = {
    FREELANCER_OAUTH_TOKEN: 'configured-test-token',
    FREELANCER_BID_SCOPE_VERIFIED: 'true',
    MARKETPLACE_AUTOSUBMIT_ENABLED: 'true',
    DB: {
      prepare(sql) {
        return {
          bind() { return this },
          async run() { return {success:true} },
          async all() { return {results:[{platform:'freelancer',status:'submitted',n:4}]} },
          async first() {
            if (!sql.includes('app_settings')) throw Error('Unexpected database query')
            return {value:JSON.stringify({status:'CHANNEL_LIMITED',reason:'bids gratuitos agotados',until})}
          }
        }
      }
    }
  }
  const r=await marketplaceSnapshot(env)
  assert.equal(r.freelancerReady,true)
  assert.equal(r.freelancerCredentialConfigured,true)
  assert.equal(r.freelancerChannelLimited,true)
  assert.equal(r.freelancerChannelLimitReason,'bids gratuitos agotados')
  assert.equal(r.freelancerChannelLimitUntil,until)
  assert.equal(r.freelancerDailyBidCap,8)
  assert.equal(r.stats[0].n,4)
})
