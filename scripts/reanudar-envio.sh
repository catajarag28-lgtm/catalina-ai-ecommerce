#!/usr/bin/env bash
# Reanuda el correo en frío de Carolina tras corregir la causa de los rebotes (6-oct-2026).
# Lo ejecuta Catalina: `! bash /c/Users/cataj/catalina-ai-ecommerce/scripts/reanudar-envio.sh`
# Los rebotes viejos ya están suprimidos; el freno sigue activo (5% en 7 días, 3 en 24 h, o una queja de spam).
cd "$(dirname "$0")/.." || exit 1
DB=carolina-portfolio
echo "1/3 Columna de línea base del freno..."
npx wrangler d1 execute $DB --remote --command "ALTER TABLE outreach_control ADD COLUMN bounce_reset_at INTEGER" 2>&1 | grep -iE "success|duplicate column|error" | head -2
echo "2/3 Reanudando envío..."
npx wrangler d1 execute $DB --remote --command "UPDATE outreach_control SET paused=0, bounce_reset_at=CAST(strftime('%s','now') AS INTEGER)*1000, reason='Reanudada por Catalina 6-oct' WHERE id=1" 2>&1 | grep -iE "success|error" | head -2
echo "3/3 Sacando tu correo de prueba de las métricas..."
npx wrangler d1 execute $DB --remote --command "UPDATE outreach SET status='internal_test' WHERE lower(email)='catalinajaramillogirldo28@gmail.com' AND status='replied'" 2>&1 | grep -iE "success|error" | head -2
echo "Estado actual:"
npx wrangler d1 execute $DB --remote --command "SELECT paused, daily_cap, reason FROM outreach_control WHERE id=1" 2>&1 | grep -E "paused|daily_cap|reason"
