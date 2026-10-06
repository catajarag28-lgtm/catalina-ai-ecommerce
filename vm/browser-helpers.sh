#!/usr/bin/env bash
# Reinstala start/stop del navegador remoto con watchdog: el runner NUNCA queda pausado.
set -euo pipefail
sudo tee /usr/local/bin/carolina-browser-start >/dev/null <<'EOS'
#!/usr/bin/env bash
set -euo pipefail
PLATFORMS="${1:-workana}"
PLATFORMS=$(printf %s "$PLATFORMS" | tr -cd "a-z0-9,"); [ -n "$PLATFORMS" ] || PLATFORMS=workana
systemctl stop carolina-cloud-runner.timer
# Watchdog en la VM: si la ventana local se cierra sin ENTER, a los 45 min se cierra todo y se reanuda el runner.
systemctl stop carolina-browser-autostop.timer >/dev/null 2>&1 || true
systemctl reset-failed carolina-browser-autostop.service carolina-browser-autostop.timer >/dev/null 2>&1 || true
systemd-run --unit=carolina-browser-autostop --on-active=45min /usr/local/bin/carolina-browser-stop >/dev/null
for i in $(seq 1 60); do systemctl is-active --quiet carolina-cloud-runner.service || break; sleep 5; done
docker rm -f carolina-browser >/dev/null 2>&1 || true
# Solo locks Singleton (Chrome no corre en este momento); el perfil no se toca.
find /home/cataj/carolina-cloud-runner/data/browser-profile -maxdepth 1 -name 'Singleton*' -delete
docker run -d --rm --name carolina-browser --memory=1600m --cpus=0.9 \
  -e PLATFORM="$PLATFORMS" -e CAROLINA_AUTH_PROFILE=/data/browser-profile \
  -p 127.0.0.1:7900:7900 \
  -v /home/cataj/carolina-cloud-runner/data:/data -v /home/cataj/carolina-cloud-runner/vm:/vm \
  carolina-cloud-runner:latest bash -c 'export DISPLAY=:99; Xvfb :99 -screen 0 1365x860x24 >/tmp/xvfb.log 2>&1 & sleep 1; fluxbox >/tmp/fb.log 2>&1 & x11vnc -display :99 -localhost -forever -shared -nopw -rfbport 5900 >/tmp/x11vnc.log 2>&1 & websockify --web=/usr/share/novnc/ 0.0.0.0:7900 localhost:5900 >/tmp/novnc.log 2>&1 & cp /vm/login-primary.mjs /app/login-primary.mjs && node /app/login-primary.mjs' >/dev/null
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:7900/vnc.html && break; sleep 1; done
echo "carolina-browser started tabs=$PLATFORMS (runner paused, autostop in 45 min)"
EOS
sudo tee /usr/local/bin/carolina-browser-stop >/dev/null <<'EOS'
#!/usr/bin/env bash
# Siempre deja el runner activo, pase lo que pase.
trap 'systemctl start carolina-cloud-runner.timer' EXIT
systemctl stop carolina-browser-autostop.timer >/dev/null 2>&1 || true
docker stop -t 15 carolina-browser >/dev/null 2>&1 || true
docker rm -f carolina-browser >/dev/null 2>&1 || true
find /home/cataj/carolina-cloud-runner/data/browser-profile -maxdepth 1 -name 'Singleton*' -delete
FORCE=1 /usr/local/bin/carolina-session-health || true
echo "carolina-browser stopped; runner timer: active"
EOS
sudo chmod 755 /usr/local/bin/carolina-browser-start /usr/local/bin/carolina-browser-stop
echo ok
