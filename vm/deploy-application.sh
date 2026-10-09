#!/usr/bin/env bash
# Ejecutar en la VM después de copiar archivos a /tmp/carolina-vm/.
set -euo pipefail
if [[ "$(hostname -s | tr '[:upper:]' '[:lower:]')" == "laura" ]]; then
  echo 'Carolina no puede ejecutarse en Laura: Laura pertenece a Professional Glam.' >&2
  exit 1
fi
R=/home/cataj/carolina-cloud-runner
STAGE=/tmp/carolina-vm
for f in action-runner.js application-policy.js application-runner.sh; do test -s "$STAGE/$f"; done
bash -n "$STAGE/application-runner.sh"
sudo systemctl stop carolina-application-runner.timer
trap 'sudo systemctl start carolina-application-runner.timer' EXIT
for i in $(seq 1 12); do
  systemctl is-active --quiet carolina-application-runner.service || break
  sleep 5
done
if systemctl is-active --quiet carolina-application-runner.service; then
  echo 'El ejecutor sigue activo; no se reemplazaron archivos.' >&2
  exit 1
fi
stamp=$(date -u +%Y%m%dT%H%M%SZ)
sudo cp "$R/vm/action-runner.js" "$R/vm/action-runner.js.bak-$stamp"
sudo cp /usr/local/bin/carolina-application-runner "/usr/local/bin/carolina-application-runner.bak-$stamp"
sudo install -m 644 "$STAGE/action-runner.js" "$R/vm/action-runner.js"
sudo install -m 644 "$STAGE/application-policy.js" "$R/vm/application-policy.js"
sudo install -m 755 "$STAGE/application-runner.sh" /usr/local/bin/carolina-application-runner
sudo systemctl disable --now carolina-linkedin-discover.timer
sha256sum "$STAGE/action-runner.js" "$R/vm/action-runner.js" "$STAGE/application-policy.js" "$R/vm/application-policy.js"
systemctl is-enabled carolina-application-runner.timer
echo 'Despliegue de Carolina terminado; el timer se reactivará al salir.'
