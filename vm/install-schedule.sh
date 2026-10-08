#!/usr/bin/env bash
# Limpieza + programación de Carolina en la VM (6-oct-2026). Solo toca lo de Carolina; Laura no se toca.
# Prerrequisito: backup verificado en /home/cataj/backups/carolina-20261006-cleanup (con SHA256SUMS).
set -euo pipefail
R=/home/cataj/carolina-cloud-runner
B=/home/cataj/backups/carolina-20261006-cleanup
[ -f $B/carolina-cloud-runner.tgz ] && [ -f $B/carolina-cloud-data.tgz ] || { echo "falta backup, abortando"; exit 1; }
trap 'systemctl start carolina-cloud-runner.timer' EXIT
systemctl stop carolina-cloud-runner.timer
for i in $(seq 1 60); do systemctl is-active --quiet carolina-cloud-runner.service || break; sleep 5; done

# 1) Descubrimiento de LinkedIn programado (13:00 y 21:00 UTC = 8 a. m. y 4 p. m. Colombia), desde el código instalado en vm/.
cp /tmp/carolina-vm/linkedin-discover.mjs $R/vm/linkedin-discover.mjs
tee /usr/local/bin/carolina-linkedin-discover >/dev/null <<'EOS'
#!/usr/bin/env bash
# Pausa el timer de salud (comparten el perfil persistente) y SIEMPRE lo reactiva.
set -u
trap 'systemctl start carolina-cloud-runner.timer' EXIT
systemctl stop carolina-cloud-runner.timer
for i in $(seq 1 90); do systemctl is-active --quiet carolina-cloud-runner.service || break; sleep 5; done
docker ps --format '{{.Names}}' | grep -qx carolina-browser && { echo "navegador remoto abierto: se omite este turno"; exit 0; }
find /home/cataj/carolina-cloud-runner/data/browser-profile -maxdepth 1 -name 'Singleton*' -delete
docker run --rm --name carolina-linkedin-discover --memory=1400m --cpus=0.9 \
  --env-file /home/cataj/carolina-cloud-runner/.vm-health.env \
  -v /home/cataj/carolina-cloud-runner/data:/data -v /home/cataj/carolina-cloud-runner/vm:/vm \
  carolina-cloud-runner:latest bash -c 'cp /vm/linkedin-discover.mjs /app/ld.mjs && timeout 1500 node /app/ld.mjs' 2>&1 | grep -E '^(search|collected|batch|linkedin)' | tail -30
EOS
chmod 755 /usr/local/bin/carolina-linkedin-discover
tee /etc/systemd/system/carolina-linkedin-discover.service >/dev/null <<'EOS'
[Unit]
Description=Carolina LinkedIn discovery (perfil persistente → cola inteligente del Worker)
After=network-online.target docker.service
[Service]
Type=oneshot
User=root
ExecStart=/usr/local/bin/carolina-linkedin-discover
TimeoutStartSec=1800
Nice=10
EOS
tee /etc/systemd/system/carolina-linkedin-discover.timer >/dev/null <<'EOS'
[Unit]
Description=Carolina LinkedIn discovery 4 veces al día
[Timer]
OnCalendar=*-*-* 12,16,20,00:00:00 UTC
Persistent=true
RandomizedDelaySec=600
[Install]
WantedBy=timers.target
EOS

# 2) El timer de 15 min deja de correr runner.js (borradores genéricos que nadie leía): solo CloudSessionHealth.
tee /etc/systemd/system/carolina-cloud-runner.service >/dev/null <<'EOS'
[Unit]
Description=Carolina CloudSessionHealth (perfil persistente) - aislado de Laura
Wants=network-online.target docker.service
After=network-online.target docker.service
[Service]
Type=oneshot
User=root
ExecStart=/usr/local/bin/carolina-session-health
TimeoutStartSec=900
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
EOS
# 3) Ejecutor periódico de postulaciones: consume SOLO /ops/vm-queue (A/B + quality gate) y devuelve evidencia a D1.
cp /tmp/carolina-vm/action-runner.js $R/vm/action-runner.js
tee /usr/local/bin/carolina-application-runner >/dev/null <<'EOS'
#!/usr/bin/env bash
set -u
R=/home/cataj/carolina-cloud-runner
trap 'systemctl start carolina-cloud-runner.timer' EXIT
systemctl stop carolina-cloud-runner.timer
for i in $(seq 1 60); do systemctl is-active --quiet carolina-cloud-runner.service || break; sleep 5; done
docker ps --format '{{.Names}}' | grep -qx carolina-browser && { echo "navegador remoto abierto: se omite este turno"; exit 0; }
find "$R/data/browser-profile" -maxdepth 1 -name 'Singleton*' -delete
docker run --rm --name carolina-application-runner --memory=1400m --cpus=0.9 \
  --env-file "$R/.vm-health.env" \
  -e CAROLINA_AUTOSUBMIT_APPROVED=yes -e CAROLINA_ACTION_MODE=live \
  -e CAROLINA_ACTION_LIMIT=0 -e CAROLINA_DAILY_LIMIT=0 -e CAROLINA_PER_PLATFORM_LIMIT=0 -e CAROLINA_DAILY_PLATFORM_LIMIT=0 \
  -v "$R/data:/data" -v "$R/vm:/vm" -v "$R/public:/public" \
  carolina-cloud-runner:latest bash -c 'cp /vm/action-runner.js /app/action-runner.js && timeout 1200 node /app/action-runner.js'
EOS
chmod 755 /usr/local/bin/carolina-application-runner
tee /etc/systemd/system/carolina-application-runner.service >/dev/null <<'EOS'
[Unit]
Description=Carolina applications executor (canonical Worker queue -> persistent cloud browser)
After=network-online.target docker.service
[Service]
Type=oneshot
User=root
ExecStart=/usr/local/bin/carolina-application-runner
TimeoutStartSec=1500
Nice=10
EOS
tee /etc/systemd/system/carolina-application-runner.timer >/dev/null <<'EOS'
[Unit]
Description=Carolina application executor every 30 minutes
[Timer]
OnBootSec=20min
OnUnitActiveSec=30min
Persistent=true
RandomizedDelaySec=120
[Install]
WantedBy=timers.target
EOS

systemctl daemon-reload
systemctl enable --now carolina-linkedin-discover.timer carolina-application-runner.timer >/dev/null

# 4) Retirar copias viejas y restos (todo está en el backup tgz). Se conservan: app/, vm/, data/, public/ (CVs), .vm-health.env.
cd $R
rm -rf worker src tests docs migrations scripts config browser browser-profile profile profiles .github
rm -f Dockerfile cloud-loop.sh index.html vite.config.js wrangler.jsonc package.json package-lock.json README.md OUTREACH_SETUP.md CAROLINA_ACQUISITION_CONSTITUTION.md .gitignore
rm -f app/*.bak-* /etc/systemd/system/carolina-cloud-runner.service.bak-*
rm -rf /home/cataj/carolina-cloud-data
rm -f /home/cataj/carolina-cloud-runner.tgz /home/cataj/check_carolina_cloud.sh /home/cataj/debug_carolina_container.sh /home/cataj/setup_carolina_cloud.sh

# 4) Imágenes y contenedores obsoletos (la imagen activa es carolina-cloud-runner:latest sobre playwright v1.56.1).
docker rm -f brave_lederberg >/dev/null 2>&1 || true
docker rmi carolina-login-browser:latest >/dev/null 2>&1 || true
docker rmi mcr.microsoft.com/playwright:v1.49.1-jammy >/dev/null 2>&1 || true

echo "== resultado"; ls -A $R; du -sh $R
systemctl list-timers --all --no-pager | grep -E 'carolina'
docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep -iE 'carolina|playwright'
df -h / | tail -1
