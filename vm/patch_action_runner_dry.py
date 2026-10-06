#!/usr/bin/env python3
# AUTO-SUBMIT OFF en la VM: el ejecutor solo corre en modo dry salvo aprobación explícita de Catalina.
import shutil, time
from pathlib import Path
p = Path('/home/cataj/carolina-cloud-runner/app/action-runner.js')
s = p.read_text(encoding='utf-8')
old = "const MODE = (process.env.CAROLINA_ACTION_MODE || 'live').toLowerCase();"
if old not in s:
    print('already patched' if 'CAROLINA_AUTOSUBMIT_APPROVED' in s else 'MODE line not found'); raise SystemExit
shutil.copy(p, p.with_name('action-runner.js.bak-dry-' + time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())))
new = ("// AUTO-SUBMIT OFF hasta validar calidad: 'live' exige CAROLINA_AUTOSUBMIT_APPROVED=yes.\n"
       "const MODE = (process.env.CAROLINA_AUTOSUBMIT_APPROVED === 'yes' ? (process.env.CAROLINA_ACTION_MODE || 'dry') : 'dry').toLowerCase();")
p.write_text(s.replace(old, new, 1), encoding='utf-8')
print('patched: MODE forced to dry')
