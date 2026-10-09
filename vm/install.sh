#!/usr/bin/env bash
# Instala en la VM: CloudSessionHealth + navegador remoto sobre el perfil PRIMARIO. Idempotente y con backup.
set -euo pipefail
if [[ "$(hostname -s | tr '[:upper:]' '[:lower:]')" == "laura" ]]; then
  echo 'Carolina no puede ejecutarse en Laura: Laura pertenece a Professional Glam.' >&2
  exit 1
fi
R=/home/cataj/carolina-cloud-runner
TS=$(date -u +%Y%m%dT%H%M%SZ)
sudo mkdir -p $R/vm
sudo cp /tmp/carolina-vm/session-health.mjs /tmp/carolina-vm/login-primary.mjs $R/vm/

# start/stop del navegador remoto (perfil primario). Pausa el runner mientras Catalina lo usa:
# Chrome no permite dos procesos sobre el mismo user-data-dir.
sudo tee /usr/local/bin/carolina-browser-start >/dev/null <<'EOS'
#!/usr/bin/env bash
set -euo pipefail
PLATFORM="${1:-workana}"
systemctl stop carolina-cloud-runner.timer
for i in $(seq 1 60); do systemctl is-active --quiet carolina-cloud-runner.service || break; sleep 5; done
docker rm -f carolina-browser >/dev/null 2>&1 || true
find /home/cataj/carolina-cloud-runner/data/browser-profile -maxdepth 1 -name 'Singleton*' -delete
docker run -d --rm --name carolina-browser --memory=1400m --cpus=0.75 \
  -e PLATFORM="$PLATFORM" -e CAROLINA_AUTH_PROFILE=/data/browser-profile \
  -p 127.0.0.1:7900:7900 \
  -v /home/cataj/carolina-cloud-runner/data:/data -v /home/cataj/carolina-cloud-runner/vm:/vm \
  carolina-cloud-runner:latest bash -c 'export DISPLAY=:99; Xvfb :99 -screen 0 1365x860x24 >/tmp/xvfb.log 2>&1 & sleep 1; fluxbox >/tmp/fb.log 2>&1 & x11vnc -display :99 -localhost -forever -shared -nopw -rfbport 5900 >/tmp/x11vnc.log 2>&1 & websockify --web=/usr/share/novnc/ 0.0.0.0:7900 localhost:5900 >/tmp/novnc.log 2>&1 & cp /vm/login-primary.mjs /app/login-primary.mjs && node /app/login-primary.mjs'
echo "carolina-browser started platform=$PLATFORM (runner paused)"
EOS
sudo tee /usr/local/bin/carolina-browser-stop >/dev/null <<'EOS'
#!/usr/bin/env bash
docker stop -t 15 carolina-browser >/dev/null 2>&1 || true
docker rm -f carolina-browser >/dev/null 2>&1 || true
# Verificación inmediata con el perfil real y reporte al Worker; luego se reanuda el runner.
FORCE=1 /usr/local/bin/carolina-session-health || true
systemctl start carolina-cloud-runner.timer
echo "carolina-browser stopped; runner resumed"
EOS
sudo tee /usr/local/bin/carolina-session-health >/dev/null <<'EOS'
#!/usr/bin/env bash
# CloudSessionHealth sobre el perfil persistente real (no corre si el navegador remoto está abierto).
docker ps --format '{{.Names}}' | grep -qx carolina-browser && { echo "session-health: remote browser open, skipped"; exit 0; }
find /home/cataj/carolina-cloud-runner/data/browser-profile -maxdepth 1 -name 'Singleton*' -delete
docker run --rm --name carolina-session-health --memory=1200m --cpus=0.75 \
  --env-file /home/cataj/carolina-cloud-runner/.vm-health.env -e FORCE="${FORCE:-}" \
  -v /home/cataj/carolina-cloud-runner/data:/data -v /home/cataj/carolina-cloud-runner/vm:/vm \
  carolina-cloud-runner:latest bash -c 'export DISPLAY=:98 HEADED=1; Xvfb :98 -screen 0 1365x900x24 >/tmp/xvfb.log 2>&1 & sleep 1; cp /vm/session-health.mjs /app/session-health.mjs && timeout 600 node /app/session-health.mjs'
EOS
sudo chmod 755 /usr/local/bin/carolina-browser-start /usr/local/bin/carolina-browser-stop /usr/local/bin/carolina-session-health

# Health después de cada ciclo del runner (el propio script se limita a 1 vez por ~55 min).
U=/etc/systemd/system/carolina-cloud-runner.service
if ! grep -q carolina-session-health $U; then
  sudo cp $U $U.bak-session-health-$TS
  sudo sed -i 's#^ExecStartPost=/usr/bin/python3 /home/cataj/carolina-cloud-runner/scripts/build-commercial-queue.py#&\nExecStartPost=-/usr/local/bin/carolina-session-health#' $U
  sudo sed -i 's/^TimeoutStartSec=420/TimeoutStartSec=900/' $U
  sudo systemctl daemon-reload
fi
grep -E 'ExecStartPost|TimeoutStartSec' $U
echo installed
