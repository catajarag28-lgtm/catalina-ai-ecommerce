import test from 'node:test'
import assert from 'node:assert/strict'
import { scoreOpportunity, atsApplyUrl } from '../worker/prospecting/opportunities.js'

test('a role requiring expert n8n and advanced English is rejected before submission',()=>{
  const result=scoreOpportunity({title:'AI Automation Engineer - n8n Expert (Remote) LATAM',description:'Advanced/Expert-level n8n experience is required. Advanced English. Build workflows and Monday.com integrations.',location:'Remote'})
  assert.equal(result.grade,'C')
  assert.ok(result.rejects.some(x=>x.includes('n8n avanzado')))
  assert.ok(result.rejects.some(x=>x.includes('inglés avanzado')))
})

test('a public job board page is not treated as an ATS form',()=>{
  assert.equal(atsApplyUrl('https://remoteok.com/remote-jobs/example'),null)
  assert.equal(atsApplyUrl('https://jobs.lever.co/example/123'),'https://jobs.lever.co/example/123')
})
