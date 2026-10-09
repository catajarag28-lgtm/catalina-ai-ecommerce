const CHANNELS = new Set(['direct_outbound','partnerships','job_applications','project_bids','intent_signals','warm_network','inbound']);

export function cleanCommercialDeal(raw = {}) {
  const dealRef=String(raw.dealRef||'').trim().slice(0,120);
  const client=String(raw.client||'').trim().slice(0,160);
  const channel=String(raw.channel||'').trim();
  const evidenceRef=String(raw.evidenceRef||'').trim().slice(0,300);
  const signedAmountUsd=Number(raw.signedAmountUsd);
  const depositAmountUsd=Number(raw.depositAmountUsd||0);
  const signedAt=Date.parse(String(raw.signedAt||''));
  const depositReceivedAt=raw.depositReceivedAt?Date.parse(String(raw.depositReceivedAt)):null;
  if(!dealRef || !client || !evidenceRef) throw new Error('deal_ref_client_evidence_required');
  if(!CHANNELS.has(channel)) throw new Error('invalid_channel');
  if(!Number.isFinite(signedAmountUsd) || signedAmountUsd<=0 || !Number.isFinite(depositAmountUsd) || depositAmountUsd<0 || depositAmountUsd>signedAmountUsd) throw new Error('invalid_amount');
  if(!Number.isFinite(signedAt) || signedAt>Date.now()+86400000 || (depositAmountUsd>0 && !Number.isFinite(depositReceivedAt))) throw new Error('invalid_dates');
  return {dealRef,client,channel,evidenceRef,signedAmountUsd,depositAmountUsd,signedAt,depositReceivedAt};
}

export async function recordCommercialDeal(env, raw) {
  const d=cleanCommercialDeal(raw);
  await env.DB.prepare(`INSERT INTO commercial_deals(deal_ref,client,channel,evidence_ref,signed_amount_usd,deposit_amount_usd,signed_at,deposit_received_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(deal_ref) DO UPDATE SET
    client=excluded.client,channel=excluded.channel,evidence_ref=excluded.evidence_ref,
    signed_amount_usd=excluded.signed_amount_usd,deposit_amount_usd=excluded.deposit_amount_usd,
    signed_at=excluded.signed_at,deposit_received_at=excluded.deposit_received_at,updated_at=excluded.updated_at`)
    .bind(d.dealRef,d.client,d.channel,d.evidenceRef,d.signedAmountUsd,d.depositAmountUsd,d.signedAt,d.depositReceivedAt,Date.now()).run();
  return {ok:true,dealRef:d.dealRef};
}

export async function commercialScorecard(env, now=Date.now()) {
  const since=now-7*86400000;
  const row=await env.DB.prepare(`SELECT
    COALESCE(SUM(CASE WHEN signed_at>=? THEN 1 ELSE 0 END),0) contracts_signed,
    COALESCE(SUM(CASE WHEN signed_at>=? THEN signed_amount_usd ELSE 0 END),0) signed_usd,
    COALESCE(SUM(CASE WHEN deposit_received_at>=? THEN deposit_amount_usd ELSE 0 END),0) deposits_collected_usd
    FROM commercial_deals WHERE signed_at>=? OR deposit_received_at>=?`).bind(since,since,since,since,since).first().catch(()=>({contracts_signed:0,signed_usd:0,deposits_collected_usd:0}));
  const signedUsd=Number(row?.signed_usd||0);
  const remainingSignedUsd=Math.max(0,10000-signedUsd);
  return {windowDays:7,targetSignedUsd:10000,contractsSigned:Number(row?.contracts_signed||0),signedUsd,depositsCollectedUsd:Number(row?.deposits_collected_usd||0),remainingSignedUsd,contractsNeededAtAverageUsd:{2000:Math.ceil(remainingSignedUsd/2000),3500:Math.ceil(remainingSignedUsd/3500),5000:Math.ceil(remainingSignedUsd/5000)}};
}
