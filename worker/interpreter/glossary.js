export const CAROLINA_GLOSSARY = Object.freeze([
  "Carolina", "Laura", "n8n", "Make", "Shopify", "WhatsApp", "CRM",
  "DTC", "COD", "ROAS", "Meta Ads", "webhook", "API", "handoff",
  "fulfillment", "customer experience", "post-purchase", "lead qualification",
]);

export function glossaryPrompt(extraTerms = []) {
  return [...new Set([...CAROLINA_GLOSSARY, ...extraTerms])].join(", ");
}
