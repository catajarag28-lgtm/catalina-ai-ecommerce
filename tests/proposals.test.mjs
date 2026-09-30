import test from 'node:test'
import assert from 'node:assert/strict'
import { renderProposalEmail } from '../worker/core/emailTemplates.js'
import { proposals } from '../src/proposals.js'
import { catalog } from '../src/offers.js'

test('every sector proposal maps to a catalog tier', () => {
  for (const p of proposals) assert.ok(catalog.find(c => c.id === p.tier), p.slug)
})

test('proposal email escapes input and links to the personalized web proposal', () => {
  const mail = renderProposalEmail({ slug: 'spa', company: 'Aura <Spa> & Co', contactName: 'Ana María' })
  assert.match(mail.html, /Aura &lt;Spa&gt; &amp; Co/)
  assert.doesNotMatch(mail.html, /<Spa>/)
  assert.match(mail.url, /\/sectores\/spa\?empresa=Aura%20%3CSpa%3E%20%26%20Co$/)
  assert.match(mail.html, /Hola Ana,/)
  assert.doesNotMatch(mail.html, /garantiz|duplic/i)
})

test('unknown sector falls back to a valid proposal', () => {
  assert.match(renderProposalEmail({ slug: 'nope' }).url, /\/sectores\/spa$/)
})


