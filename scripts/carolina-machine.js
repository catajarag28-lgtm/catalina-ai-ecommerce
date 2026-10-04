#!/usr/bin/env node
/**
 * Carolina Machine Orchestrator
 * Official local production entrypoint.
 *
 * Runs the Carolina acquisition system in a strict order:
 * 1. Open/refresh local platform sessions.
 * 2. Scan opportunities.
 * 3. Apply only to free/no-risk opportunities.
 * 4. Generate B2B prospecting drafts.
 * 5. Produce a local evidence report.
 *
 * It never stores passwords, never exports cookies, never bypasses CAPTCHA/MFA,
 * and never spends Connects/money unless explicitly configured later.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const ROOT = process.env.CAROLINA_LOCAL_ROOT || path.join(os.homedir(), 'CarolinaLocalRunner')
const LOG_DIR = path.join(ROOT, 'logs')
const REPORT = path.join(ROOT, 'CAROLINA_MACHINE_STATUS.md')
const DEFAULT_MAX_APPLY = process.env.CAROLINA_SAFE_APPLY_LIMIT || '3'

fs.mkdirSync(LOG_DIR, { recursive: true })

function stamp(){ return new Date().toISOString() }
function run(label, args, extraEnv = {}) {
  const logfile = path.join(LOG_DIR, `${new Date().toISOString().slice(0,10)}-${label}.log`)
  const env = { ...process.env, ...extraEnv }
  const started = Date.now()
  const res = spawnSync(process.execPath, args, { env, encoding: 'utf8', timeout: 180000 })
  const body = [
    `\n### ${stamp()} ${label}`,
    `command: node ${args.join(' ')}`,
    `exit: ${res.status ?? 'null'}`,
    res.stdout || '',
    res.stderr || ''
  ].join('\n')
  fs.appendFileSync(logfile, body)
  return { label, ok: res.status === 0, status: res.status, ms: Date.now() - started, logfile }
}

const steps = []
steps.push(run('runner', ['scripts/runner-local.js', 'run'], {
  CAROLINA_LOCAL_MAX_PLATFORMS: process.env.CAROLINA_LOCAL_MAX_PLATFORMS || '11',
  CAROLINA_LOCAL_PLATFORMS: process.env.CAROLINA_LOCAL_PLATFORMS || 'linkedin,upwork,workana,n8n,make,contra,wellfound,twine,guru,malt,peopleperhour'
}))
steps.push(run('opportunity-engine', ['scripts/carolina-opportunity-engine.js']))
steps.push(run('safe-auto-apply', ['scripts/safe-auto-apply.js'], {
  CAROLINA_SAFE_APPLY_LIMIT: DEFAULT_MAX_APPLY,
  CAROLINA_SAFE_APPLY_PLATFORMS: process.env.CAROLINA_SAFE_APPLY_PLATFORMS || 'linkedin,workana,twine,guru,peopleperhour'
}))
steps.push(run('business-prospecting', ['scripts/business-prospecting-engine.js']))

const summary = [`# Carolina Machine Status`, `Updated: ${stamp()}`, '', '## Steps']
for (const s of steps) summary.push(`- ${s.ok ? '✅' : '⚠️'} ${s.label}: exit=${s.status}, ms=${s.ms}, log=${s.logfile}`)
summary.push('', '## Rules')
summary.push('- Auto-submit is allowed only when the platform flow is free and has no CAPTCHA/MFA/payment/Connects/membership barrier.')
summary.push('- Upwork Connects, paid certifications, memberships, checkout pages and ambiguous final submits remain WAITING_HUMAN.')
summary.push('- Evidence is kept in the local CarolinaLocalRunner data/log folders.')
fs.writeFileSync(REPORT, summary.join('\n'))
console.log(summary.join('\n'))
process.exit(steps.some(s => !s.ok) ? 1 : 0)
