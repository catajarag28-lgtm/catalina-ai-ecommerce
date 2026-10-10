#!/usr/bin/env bash
# Resumen de entregabilidad (SOLO LECTURA).
# Esta utilidad ya no reanuda el correo: la ausencia de quejas durante 72h,
# o marcar rebotes previos como "viejos", NO demuestra que la causa se resolvió.
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1
echo "SEGURIDAD: no se reactivará el correo frío desde este script."
npx wrangler d1 execute carolina-portfolio --remote --command "SELECT paused, daily_cap, reason, updated_at FROM outreach_control WHERE id=1; SELECT type,COUNT(*) AS events FROM outreach_events WHERE type IN ('email.sent','email.bounced','email.complained','email.delivered') AND occurred_at >= CAST(strftime('%s','now','-7 days') AS INTEGER)*1000 GROUP BY type;"
echo "Se requiere auditoría de rebotes, verificador activo, reputación y autorización humana explícita."
echo "Conservar suppression y los eventos históricos; no reestablecer el contador de rebotes."
exit 1
