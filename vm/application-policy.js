const PROPOSAL_LABEL = /(?:cover\s*letter|proposal|your\s+(?:bid|message|application)|message\s+to\s+(?:client|employer)|why\s+(?:are\s+you|do\s+you)|carta\s+de\s+presentaci[oó]n|propuesta|mensaje\s+(?:al|para\s+el)\s+cliente|motivaci[oó]n)/i;
const SENSITIVE_LABEL = /(?:salary|compensation|hourly|rate|tarifa|sueldo|salario|disponibilidad|availability|visa|work\s+authorization|citizenship|legal\s+status|date\s+of\s+birth|birth\s*date)/i;
const CLOSED_TEXT = /(?:job\s+(?:is\s+)?(?:closed|expired|no\s+longer\s+available)|position\s+(?:has\s+been\s+)?filled|applications?\s+closed|project\s+(?:is\s+)?closed|vacante\s+(?:cerrada|expirada)|postulaciones?\s+cerradas|proyecto\s+cerrado)/i;
const COST_TEXT = /(?:buy\s+(?:more\s+)?credits|purchase\s+connects|connects\s+required|proposal\s+credits|payment\s+required|credit\s+card\s+required|upgrade\s+(?:your\s+)?plan|membership\s+required|comprar\s+cr[eé]ditos|pagar\s+para\s+postular)/i;

export function fieldKind(label='') {
  const text=String(label).trim();
  if(SENSITIVE_LABEL.test(text)) return 'human';
  if(PROPOSAL_LABEL.test(text)) return 'proposal';
  return 'unknown';
}

export function pageBlocker(text='') {
  const value=String(text);
  if(COST_TEXT.test(value)) return 'payment_required';
  if(CLOSED_TEXT.test(value)) return 'opportunity_closed';
  return null;
}

export function freshEnough(item, now=Date.now()) {
  const value=item?.publishedAt ?? item?.foundAt ?? item?.createdAt;
  const when=typeof value==='number'?value:Date.parse(value||'');
  if(!Number.isFinite(when) || when<=0 || when>now+86400000) return false;
  const platform=String(item?.platform||'').toLowerCase();
  const community=/community|forum|n8n|make|reddit|skool/.test(platform);
  return now-when <= (community?21:45)*86400000;
}
