# Carolina Forensic Audit — Acquisition Machine

## Mission

Carolina must not behave like a generic job bot. Carolina must behave like a commercial operator that studies each opportunity, identifies a specific improvement, writes a relevant proposal, routes the right offer and learns from replies.

## Critical findings

### 1. Missing opportunity engine

`package.json` referenced `scripts/carolina-opportunity-engine.js`, but the file was missing from the repository. This created a disconnected/ghost command.

Fixed by adding:

- `scripts/carolina-opportunity-engine.js`

### 2. Generic B2B proposal risk

The first B2B prospecting script generated usable but generic drafts. It did not deeply adapt by industry, visible leakage or offer ladder.

Fixed by adding:

- `scripts/carolina-proposal-intelligence.js`
- updated `scripts/business-prospecting-engine.js`

### 3. Missing anti-generic QA

Carolina had no explicit checks for proposals that sound like AI templates.

Fixed by adding an anti-generic checklist:

- must include a specific observation
- must name a likely leakage/opportunity
- must define a first implementation step
- must mention measurement/follow-up/CRM/pipeline
- must include `https://soycatalinajaramillo.com`
- must avoid generic openings like “I can help with this”

### 4. Safe action rules already exist but must remain strict

Carolina may apply only when the action is free, clear and unambiguous.

Carolina must stop for:

- Connects or paid credits
- checkout, billing, membership or certification
- CAPTCHA, MFA or verification
- unclear final submit button
- sensitive personal data

## New intelligence architecture

### Proposal Intelligence

File:

```text
scripts/carolina-proposal-intelligence.js
```

Responsibilities:

1. Detect industry.
2. Select offer ladder.
3. Create non-generic proposal.
4. Add portfolio link.
5. Produce QA flags.
6. Record learning events.

### Opportunity Engine

File:

```text
scripts/carolina-opportunity-engine.js
```

Responsibilities:

1. Read platform/business opportunities.
2. Generate opportunity records.
3. Create tailored proposal drafts.
4. Assign offer/ticket/CV.
5. Mark status and next action.

### Business Prospecting Engine

File:

```text
scripts/business-prospecting-engine.js
```

Responsibilities:

1. Create B2B prospecting queues.
2. Generate market/segment-specific proposals.
3. Require human-grade personalization before sending.

## Required behavior for every proposal

Carolina must write proposals using this structure:

1. **Observation** — What Carolina noticed about the business/opportunity.
2. **Leakage** — Where money/time/leads are likely being lost.
3. **System idea** — What should be built or improved.
4. **First step** — A practical small implementation.
5. **Measurement** — What will be tracked.
6. **Proof/positioning** — Catalina's operator background.
7. **Portfolio link** — `https://soycatalinajaramillo.com`.
8. **Low-friction CTA** — short proposal, call or first audit.

## Offer routing

- `AI Automation Quick Win`: USD 500-900
- `WhatsApp / CRM Sales Agent Starter`: USD 900-1,800
- `Ecommerce Growth Operations System`: USD 1,800-4,000
- `Multi-Agent Commercial OS`: USD 4,000-10,000
- `Monthly Growth Automation Retainer`: USD 1,000-4,000/month

## Learning loop

Every response must be logged with:

- proposal angle
- industry
- offer
- status: sent, opened, replied, booked, won, lost
- objection
- next follow-up
- outcome

Carolina must improve by favoring angles that create replies, calls and contracts, not just sent volume.

## Final readiness definition

Carolina is ready only when:

- all official modules exist in GitHub
- local PC pulls the latest repo
- `npm run carolina:machine` runs without missing file errors
- CRM receives opportunities and statuses
- Gmail/cloud flow sends B2B outreach only with clear contact and personalization
- daily report shows volume, replies, calls and pipeline value
