# Carolina Senior Commercial Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Carolina into a humanized senior commercial advisor that finds qualified opportunities, diagnoses the real need, explains a useful preliminary solution and orientative investment, follows up, and books qualified meetings with Catalina.

**Architecture:** Keep one canonical commercial knowledge registry in `worker/skills/registry.js`, then make prospecting, proposal writing, chat qualification, follow-up, and the proposal page consume the same diagnosis contract. Add a deterministic quality gate before sending and a funnel record that preserves evidence, assumptions, offer, range, signals, and next step. The public site and email remain two views of the same proposal record.

**Tech Stack:** Cloudflare Worker, D1, OpenRouter structured JSON, Resend, existing proposal renderer, Node test runner, Wrangler.

---

### Task 1: Define the senior, humanized commercial contract

**Files:**
- Modify: `worker/skills/registry.js`
- Modify: `worker/skills/copywriting.js`
- Modify: `worker/skills/proposalPlaybook.js`
- Modify: `worker/skills/salesStrategy.js`
- Test: `tests/skills.test.mjs`

- [ ] **Step 1: Add the commercial decision rules**

Add one canonical skill block covering: listen first; one useful question per turn; facts versus hypotheses; one primary pain; solution selection across sales, service, operations, finance, ecommerce, Meta and automation; orientative ranges only; Catalina confirms final scope; and meeting only after the prospect understands the value and shows interest.

- [ ] **Step 2: Add humanization rules**

Require natural Spanish, varied sentence length, concrete business language, acknowledgement of the prospect's last message, no repeated greetings, no “como IA”, no inflated claims, no generic praise, and no pressure. Require Carolina to say what she knows, what she suspects, and what she needs to validate.

- [ ] **Step 3: Add meaningful skill coverage**

Consolidate the useful parts of customer research, senior B2B copywriting, marketing psychology, sales enablement, CRO, Meta growth, automation, ecommerce retention, and commercial analytics into this registry. Do not add independent prompt repositories that can contradict the registry.

- [ ] **Step 4: Add regression tests**

Test that the generated skill prompt contains the humanized voice, diagnosis contract, value-first structure, orientative pricing rule, and the meeting qualification rule.

- [ ] **Step 5: Run the focused test**

Run: `npm test -- tests/skills.test.mjs`

Expected: PASS.

### Task 2: Make proposal generation evidence-led and persuasive

**Files:**
- Modify: `worker/proposals/outreach.js`
- Modify: `worker/skills/copywriting.js`
- Modify: `worker/skills/proposalPlaybook.js`
- Test: `tests/proposals.test.mjs`
- Test: `tests/creative.test.mjs`

- [ ] **Step 1: Expand the proposal JSON contract**

Require the model to return `observations`, `sourceEvidence`, `primaryPain`, `businessConsequence`, `validationQuestion`, `customerScene`, `recommendedSolution`, `benefits`, `whyNow`, `proofBoundary`, `investmentRange`, `objection`, `cta`, and three subject candidates. Every observation must identify its public source; unsupported pain must remain a hypothesis.

- [ ] **Step 2: Add the persuasion quality gate**

Reject or rewrite proposals that have no verified observation, more than one primary pain, generic benefits, a solution unrelated to the evidence, a missing customer scene, unsupported metrics, a self-focused opening, or a CTA that asks for a meeting before establishing relevance.

- [ ] **Step 3: Improve subject selection**

Generate three subject lines based on the verified observation. Ban generic “propuesta”, “IA”, “automatización”, fake urgency, fake curiosity, all-caps, emojis, and unsupported claims. Store the selected subject and alternatives for later learning.

- [ ] **Step 4: Rewrite the email around the prospect**

Render a short email with: specific observation, careful hypothesis, consequence, one concrete scene, benefit, proposal link, and one CTA. Keep Catalina’s credibility to a short closing block. Include the legal footer and unsubscribe controls.

- [ ] **Step 5: Test sectors and failure cases**

Add tests for spa, real estate, service business, ecommerce, operations, and finance. Add negative tests for generic text, invented deficiencies, unsupported ROI, price in a cold proposal, and a proposal that recommends a chatbot when the evidence points to an operational flow or dashboard.

- [ ] **Step 6: Run proposal tests**

Run: `npm test -- tests/proposals.test.mjs tests/creative.test.mjs`

Expected: PASS.

### Task 3: Align the public proposal page with the email

**Files:**
- Modify: `worker/proposals/proposalPage.js`
- Modify: `src/components/ProposalPage.jsx`
- Modify: `src/styles.css`
- Test: `tests/creative.test.mjs`

- [ ] **Step 1: Add the branded visual system**

Use Catalina’s black, gold, and white identity with consistent type hierarchy, whitespace, buttons, and evidence blocks. Show `Preparado para [logo]` only when a verified logo exists.

- [ ] **Step 2: Add the value-first sections**

Render “Lo que vimos”, “Lo que podría estar pasando”, “La escena en su negocio”, “Cómo ayudaría”, “Qué mediríamos”, “Qué debemos validar”, and “Siguiente paso”. Select conversation, workflow, dashboard, or agent demo according to the recommended solution.

- [ ] **Step 3: Keep page and email consistent**

Use the same observation, hypothesis, primary pain, solution, benefits, range policy, and CTA from the proposal record. Do not let the page invent claims that are absent from the email data.

- [ ] **Step 4: Test rendering**

Verify escaping, no generic filler, one primary CTA, correct logo handling, and appropriate demo visibility for partners versus final prospects.

- [ ] **Step 5: Run the focused test**

Run: `npm test -- tests/creative.test.mjs`

Expected: PASS.

### Task 4: Improve qualification, warm-up, and closing

**Files:**
- Modify: `worker/index.js`
- Modify: `worker/core/qualification.js`
- Modify: `worker/core/knowledge.js`
- Modify: `worker/proposals/outreach.js`
- Test: `tests/qualification.test.mjs`
- Test: `tests/outreach.test.mjs`

- [ ] **Step 1: Make chat qualification conversational**

Preserve the last answer, acknowledge it, contribute a useful interpretation, and ask at most one next question. Capture business, problem, current process, desired result, decision maker, budget range, urgency, objections, and preferred next step without turning the chat into a form.

- [ ] **Step 2: Explain value before price**

When asked about cost, Carolina explains what changes, which package is a preliminary fit, the orientative range, what affects final scope, and what Catalina confirms. It never presents a final quote or contract.

- [ ] **Step 3: Gate the meeting on interest and fit**

Offer the meeting after the prospect confirms that the problem and proposed direction are relevant, or explicitly asks to advance. Keep low-fit and no-budget conversations in written follow-up rather than filling Catalina’s calendar.

- [ ] **Step 4: Add objection responses**

Handle price, existing staff, existing chatbot, no priority, and “send information” with empathy, a proportional response, and a single next step. Never use fake urgency or invented scarcity.

- [ ] **Step 5: Test the conversation path**

Run: `npm test -- tests/qualification.test.mjs tests/outreach.test.mjs`

Expected: PASS.

### Task 5: Make the funnel measurable and reviewable

**Files:**
- Modify: `worker/proposals/engagement.js`
- Modify: `worker/proposals/creative.js`
- Modify: `worker/prospecting/discovery.js`
- Modify: `worker/index.js`
- Test: `tests/engagement.test.mjs`
- Test: `tests/integrations.test.mjs`

- [ ] **Step 1: Preserve the full prospect dossier**

Store source, literal evidence, sector, country, contact source, diagnosis, angle, subject alternatives, selected offer, range policy, events, objections, and result in one outreach record.

- [ ] **Step 2: Add daily commercial reporting**

Report verified prospects, proposals sent, delivered, opened, clicked, demo used, replied, qualified, meetings booked, and closed outcomes by source and sector. Keep the report actionable and send it to Catalina.

- [ ] **Step 3: Make learning outcome-based**

Optimize toward replies, qualified meetings, and paid clients. Treat opens and clicks as diagnostic signals only. Retire weak angles and create new ones from real objections and interests.

- [ ] **Step 4: Verify source constraints**

Keep public research respectful, deduplicate contacts, obey suppression and unsubscribe records, do not auto-post on platforms that prohibit automation, and keep manual platform opportunities in a queue for Catalina.

- [ ] **Step 5: Run the funnel tests**

Run: `npm test -- tests/engagement.test.mjs tests/integrations.test.mjs`

Expected: PASS.

### Task 6: Validate production behavior and deploy in checkpoints

**Files:**
- Modify: `docs/CAROLINA.md`
- Modify: `OUTREACH_SETUP.md`
- Modify: `docs/CAROLINA_SKILLS.md`
- Modify: `docs/DEPLOY_CAROLINA.md`

- [ ] **Step 1: Regenerate the skills documentation**

Run: `npm run skills:doc`

Expected: `docs/CAROLINA_SKILLS.md` matches the registry.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: PASS with no skipped commercial tests.

- [ ] **Step 3: Render a realistic preview set**

Run: `npm run render:email-preview` and inspect the generated proposal, email, and page for a spa, an ecommerce business, and an operations business.

- [ ] **Step 4: Verify production health**

Check `/health`, confirm model, email, metrics, notification, postal, and outreach status, then run only the documented safe smoke checks.

- [ ] **Step 5: Deploy and verify one controlled cycle**

Deploy the Worker, verify the health response, confirm the internal notification and the external proposal event, and record the first real results in the daily commercial report.

