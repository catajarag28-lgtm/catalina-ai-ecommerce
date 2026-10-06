#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const ROOT = process.env.CAROLINA_LOCAL_ROOT || path.join(os.homedir(), 'CarolinaLocalRunner')
const appsDir = path.join(ROOT, 'data', 'applications')
const businessDir = path.join(ROOT, 'data', 'business')
const report = path.join(ROOT, 'CAROLINA_PIPELINE_SCOREBOARD.md')
function readJson(p, fallback){ try { return JSON.parse(fs.readFileSync(p,'utf8')) } catch { return fallback } }
const opp = readJson(path.join(appsDir,'latest-opportunities.json'), {opportunities:[]})
const safe = readJson(path.join(appsDir,'safe-auto-apply-results.json'), readJson(path.join(ROOT,'outreach','safe-auto-apply-results.json'), {results:[]}))
const b2b = readJson(path.join(businessDir,'business-prospects.json'), readJson(path.join(ROOT,'business-outreach','business-prospects.json'), {prospects:[]}))
const opportunities = opp.opportunities || []
const applyResults = safe.results || []
const prospects = b2b.prospects || []
const byStatus = {}
for (const x of opportunities) byStatus[x.status || 'UNKNOWN'] = (byStatus[x.status || 'UNKNOWN'] || 0) + 1
const applyByStatus = {}
for (const x of applyResults) applyByStatus[x.status || 'UNKNOWN'] = (applyByStatus[x.status || 'UNKNOWN'] || 0) + 1
const ready = opportunities.filter(x => /AUTO_SUBMIT|READY|PERSONALIZED/.test(x.status || '')).length
const blocked = opportunities.filter(x => /WAITING|BLOCK|HUMAN/.test(x.status || '')).length
const submitted = applyResults.filter(x => /SUBMITTED_CONFIRMED/.test(x.status || '')).length
const clickedUnconfirmed = applyResults.filter(x => /UNCONFIRMED/.test(x.status || '')).length
const waitingHuman = applyResults.filter(x => /WAITING|PREPARED/.test(x.status || '')).length
const lines = []
lines.push('# Carolina Pipeline Scoreboard')
lines.push(`Updated: ${new Date().toISOString()}`)
lines.push('')
lines.push('## Reality check')
lines.push(`- Opportunities found: ${opportunities.length}`)
lines.push(`- B2B prospecting lines: ${prospects.length}`)
lines.push(`- Ready / eligible records: ${ready}`)
lines.push(`- Blocked or needs human review: ${blocked}`)
lines.push(`- Submitted confirmed in latest safe-apply results: ${submitted}`)
lines.push(`- Clicked but not confirmed: ${clickedUnconfirmed}`)
lines.push(`- Waiting/prepared/no final button: ${waitingHuman}`)
lines.push('')
lines.push('## Required commercial target')
lines.push('- Real conversations today: target 8–12')
lines.push('- Real calls today: target 5–6')
lines.push('- Weekly contracts target: 3')
lines.push('- If conversations stay at 0, increase qualified direct outreach and follow-up, not only platform applications.')
lines.push('')
lines.push('## Opportunity statuses')
for (const [k,v] of Object.entries(byStatus)) lines.push(`- ${k}: ${v}`)
lines.push('')
lines.push('## Apply statuses')
for (const [k,v] of Object.entries(applyByStatus)) lines.push(`- ${k}: ${v}`)
lines.push('')
lines.push('## Next action')
if (submitted === 0) {
  lines.push('No confirmed submissions in latest cycle. Prioritize extracting concrete project pages and sending B2B personalized outreach via Gmail with opt-out and follow-up.')
} else {
  lines.push('Follow up on confirmed submissions and monitor replies within 24–48h.')
}
fs.writeFileSync(report, lines.join('\n'))
console.log(lines.join('\n'))
