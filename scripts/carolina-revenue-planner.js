#!/usr/bin/env node
/**
 * Carolina Revenue Planner
 * Turns revenue goals into daily activity targets.
 * This is intentionally conservative: Carolina must create more qualified demand than needed
 * so the system can still win when conversion is imperfect.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const configPath = path.join(root, 'config', 'carolina-revenue-targets.json')
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'))

function ceil(n){ return Math.ceil(Number(n || 0)) }
function planner(config){
  const c = config.conversion_assumptions
  const targetCalls = config.daily_targets.real_calls_target_max
  const targetContractsWeekly = config.weekly_targets.contracts_target
  const callsNeededWeekly = ceil(targetContractsWeekly / c.call_to_contract_rate)
  const callsNeededDaily = ceil(callsNeededWeekly / 5)
  const repliesNeededDaily = ceil(Math.max(targetCalls, callsNeededDaily) / c.reply_to_call_rate)
  const coldOutreachNeededDaily = ceil(repliesNeededDaily / c.cold_b2b_reply_rate)
  const platformRepliesNeededDaily = ceil(Math.max(3, targetCalls * 0.4) / c.platform_reply_to_call_rate)
  const platformApplicationsNeededDaily = ceil(platformRepliesNeededDaily / c.platform_application_reply_rate)
  return {
    mission: config.mission,
    minimum_daily_calls_to_hit_weekly_contract_goal: callsNeededDaily,
    recommended_daily_targets: {
      real_calls: `${config.daily_targets.real_calls_target_min}-${config.daily_targets.real_calls_target_max}`,
      qualified_replies: Math.max(config.daily_targets.qualified_replies_target, repliesNeededDaily),
      b2b_outreach: Math.max(config.daily_targets.b2b_outreach_target, coldOutreachNeededDaily),
      free_platform_applications: Math.max(config.daily_targets.applications_free_target, platformApplicationsNeededDaily),
      proposals: config.daily_targets.qualified_proposals_target,
      followups: config.daily_targets.followups_due_target
    },
    weekly_targets: config.weekly_targets,
    offer_ladder: config.offer_catalog.map(o => ({ name:o.name, range:`$${o.price_usd_min}-$${o.price_usd_max}`, best_for:o.best_for })),
    operating_rule: 'Overproduce qualified demand. Never spend money or bypass platform/security checks. Track every action and follow up.'
  }
}

const result = planner(cfg)
console.log(JSON.stringify(result, null, 2))
