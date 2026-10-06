# Archivo (limpieza forense del 6-oct-2026)

Nada de esta carpeta se ejecuta en producción. Se conserva para poder recuperar ideas o código.

- `pc-local-runner/`: scripts de la máquina local de la PC (`carolina-machine`, `runner-local`, `safe-auto-apply` y otros) con su configuración. Los ejecutaba la tarea programada de Windows "Carolina Local Runner", hoy deshabilitada. Solo escribían archivos locales que ningún sistema leía. Las rutas relativas internas ya no resuelven desde aquí.
- `wsl-unpublished-20261006/`: código que existía únicamente en la copia del repositorio dentro de WSL y nunca llegó a GitHub:
  - `worker/core/vmBridge.js` (4-oct): primer intento de puente VM ↔ Worker. Lo reemplaza la cola `opportunities` con `/ops/vm-opportunities`.
  - `scripts/`: 3 auditorías en Python y 3 scripts de la máquina local (gmail-outreach-bridge, contact-enrichment-plan y pipeline-scoreboard).
  - `IMPORT_STATE_ROUTE_REF.txt`: referencia a la ruta `/ops/browser/import-state`, que solo existía en esa copia.

Backups completos de la misma fecha: tag `pre-cleanup-20261006` (y `backup/*-20261006` para las 3 ramas), `C:\Users\cataj\CarolinaArchive-20261006` en la PC y `/home/cataj/backups/carolina-20261006-cleanup` en la VM.
