> **Corrección de arquitectura (9-oct-2026):** Laura pertenece a Professional Glam. La ejecución de Carolina en esa VM quedó desactivada. La arquitectura vigente está en `docs/CURRENT_STATE.md`; cualquier referencia a esa VM en este documento es histórica.

# Carolina Verified Applications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Carolina's VM browser submit only current, affordable, complete applications and record verifiable results plus signed and collected revenue.

**Architecture:** Worker maintains the canonical qualified queue. A pure VM policy module classifies fields and freshness; the Playwright runner interacts with browser controls and stores local evidence. D1 separates signed contract value from collected deposits.

**Tech Stack:** Cloudflare Worker, D1 SQL, Node.js, Playwright, node:test.

---

### Task 1: Browser policy and queue freshness

**Files:** Create `vm/application-policy.js`; modify `worker/core/vmBridge.js`; test `tests/application-policy.test.mjs`.

- [ ] Write tests that reject stale opportunities and paid or ambiguous routes, and classify proposal fields by label.
- [ ] Run `node --test tests/application-policy.test.mjs` and confirm the tests fail.
- [ ] Implement pure policy helpers and use source age in the Worker queue; never use `updated_at` as publication date.
- [ ] Run the tests and confirm they pass.

### Task 2: Accurate UI execution

**Files:** Modify `vm/action-runner.js`; test `tests/application-policy.test.mjs`.

- [ ] Select only one proposal field; do not fill salary, availability, or other preferences from fixed defaults.
- [ ] Require a complete form, cost check, and visible final control before a live click. Use actual click outcome; do not report swallowed errors as actions.
- [ ] Capture screenshot and page confirmation after sending. Keep unconfirmed clicks out of submitted counts.
- [ ] Run `node --check vm/action-runner.js` and policy tests.

### Task 3: Revenue truth and operating documentation

**Files:** Create `migrations/0015_contract_deposits.sql`; modify `worker/core/revenueMetrics.js`, `docs/CURRENT_STATE.md`; test `tests/revenue-metrics.test.mjs`.

- [ ] Add signed contract and deposit fields with separate totals. Label forecast as model projection.
- [ ] Update operating guidance for VM browser use and human intervention.
- [ ] Run relevant tests and full `node --test tests/*.test.mjs`, then `npm run build`.

### Task 4: Release verification

**Files:** No new source files.

- [ ] Review the diff for credentials and unrelated edits.
- [ ] Verify test and build output again before commit.
- [ ] Deploy Worker and VM only if their existing authenticated deployment paths are available; confirm `/health` and VM result reporting after deployment.
