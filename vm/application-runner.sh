#!/usr/bin/env bash
# Ejecuta la cola canónica de Carolina en el navegador persistente de la VM.
set -u
R=/home/cataj/carolina-cloud-runner
trap 'systemctl start carolina-cloud-runner.timer' EXIT
systemctl stop carolina-cloud-runner.timer
for i in $(seq 1 60); do systemctl is-active --quiet carolina-cloud-runner.service || break; sleep 5; done
docker ps --format '{{.Names}}' | grep -qx carolina-browser && { echo 'navegador remoto abierto: se omite este turno'; exit 0; }
find "$R/data/browser-profile" -maxdepth 1 -name 'Singleton*' -delete
docker run --rm --name carolina-application-runner --memory=1400m --cpus=0.9 \
  --env-file "$R/.vm-health.env" \
  -e CAROLINA_AUTOSUBMIT_APPROVED=yes -e CAROLINA_ACTION_MODE=live \
  -e CAROLINA_ACTION_LIMIT=12 -e CAROLINA_DAILY_LIMIT=20 \
  -e CAROLINA_PER_PLATFORM_LIMIT=5 -e CAROLINA_DAILY_PLATFORM_LIMIT=8 \
  -v "$R/data:/data" -v "$R/vm:/vm" -v "$R/public:/public" \
  carolina-cloud-runner:latest bash -c 'export DISPLAY=:98; Xvfb :98 -screen 0 1365x900x24 >/tmp/carolina-xvfb.log 2>&1 & sleep 1; cp /vm/action-runner.js /app/action-runner.js; cp /vm/application-policy.js /app/application-policy.js; timeout 1200 node /app/action-runner.js'
