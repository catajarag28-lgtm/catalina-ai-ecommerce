#!/usr/bin/env bash
# Corre el descubrimiento de LinkedIn sobre el perfil persistente; pausa el runner y SIEMPRE lo reactiva.
set -u
trap 'systemctl start carolina-cloud-runner.timer' EXIT
sudo cp /tmp/carolina-vm/linkedin-discover.mjs /home/cataj/carolina-cloud-runner/vm/
systemctl stop carolina-cloud-runner.timer
for i in $(seq 1 90); do systemctl is-active --quiet carolina-cloud-runner.service || break; sleep 5; done
docker ps --format '{{.Names}}' | grep -qx carolina-browser && { echo "remote browser open; abort"; exit 1; }
find /home/cataj/carolina-cloud-runner/data/browser-profile -maxdepth 1 -name 'Singleton*' -delete
docker run --rm --name carolina-linkedin-discover --memory=1400m --cpus=0.9 \
  --env-file /home/cataj/carolina-cloud-runner/.vm-health.env \
  -v /home/cataj/carolina-cloud-runner/data:/data -v /home/cataj/carolina-cloud-runner/vm:/vm \
  carolina-cloud-runner:latest bash -c 'cp /vm/linkedin-discover.mjs /app/ld.mjs && timeout 1500 node /app/ld.mjs' 2>&1 | grep -E '^(search|collected|batch|SUMMARY|linkedin)'
echo "timer will be restarted"
