# Carolina Machine — Production Architecture

Carolina is Catalina Jaramillo's acquisition and application operating system. It is designed to find opportunities, prepare proposals, apply only when safe/free, and generate B2B outreach queues without spending money or bypassing platform security.

## Core principle

Carolina may act automatically only when the action is free and unambiguous.

It must stop and mark `WAITING_HUMAN` when a platform asks for:

- Upwork Connects or paid credits
- checkout, billing, membership or certification payment
- CAPTCHA, MFA, email verification or identity verification
- sensitive personal information
- unclear final submit buttons

## Official modules

### `scripts/carolina-machine.js`
Main orchestrator. Runs the full local machine in order:

1. `runner-local.js`
2. `carolina-opportunity-engine.js`
3. `safe-auto-apply.js`
4. `business-prospecting-engine.js`

### `scripts/runner-local.js`
Opens and refreshes platform sessions using local Chrome profiles. It does not store passwords, print cookies or bypass login.

### `scripts/carolina-opportunity-engine.js`
Reads visible opportunity pages, extracts candidate opportunities, scores fit and creates proposal drafts.

### `scripts/safe-auto-apply.js`
Conservative application gate. The repository version marks opportunities as safe for browser submit; the local PC version may click/submit only when the platform confirms there is no cost or security barrier.

### `scripts/business-prospecting-engine.js`
Creates direct B2B prospecting queues by market and segment. It prepares proposals for businesses but does not spam. Sending must go through the approved Gmail/cloud flow.

## Local PC folders

Official Carolina local root:

```text
C:\Users\cataj\CarolinaLocalRunner
```

Recommended structure:

```text
bin\        launchers and local wrappers
config\     permissions and market configuration
data\       application and business queues
logs\       execution logs
archive\    old experimental files
CVs\        current approved CV PDFs
profiles\   local Chrome profiles per platform
```

## Approved CV files

- `Catalina_Jaramillo_AI_Commerce_CV_EN_PHOTO_FULL.pdf` — default international CV
- `Catalina_Jaramillo_AI_Commerce_CV_ES_PHOTO_FULL.pdf` — Workana / LatAm CV
- `Catalina_Jaramillo_AI_Commerce_CV_BILINGUAL_EN_ES_PHOTO_FULL.pdf` — when only one file is allowed

## Operating cadence

Small stable cycles are preferred over opening many tabs at once:

- search and extract opportunities
- prepare proposals
- apply up to a small limit of free opportunities per cycle
- record evidence
- move paid or blocked opportunities to `WAITING_HUMAN`

## Current safety status

- Auto-submit free only: allowed
- Paid platforms / Connects / memberships: blocked
- Upwork Connects: blocked until Catalina explicitly authorizes a budget
- CAPTCHA/MFA/email verification: human only
