#!/usr/bin/env python3
# El ejecutor de la VM solo actúa en plataformas CONNECTED según CloudSessionHealth (perfil real).
import shutil, time
from pathlib import Path
p = Path('/home/cataj/carolina-cloud-runner/app/action-runner.js')
s = p.read_text(encoding='utf-8')
if 'sessionConnected' in s:
    print('already patched'); raise SystemExit
shutil.copy(p, p.with_name('action-runner.js.bak-session-gate-' + time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())))
gate = '''
// CloudSessionHealth: solo plataformas CONNECTED (probe real del perfil persistente, < 3 h).
const SESSION_HEALTH = path.join(DATA, 'session-health.json');
function sessionConnected(p){
  try{
    const h = JSON.parse(fs.readFileSync(SESSION_HEALTH,'utf8'));
    if(Date.now() - Date.parse(h.at) > 3*3600*1000) return false;
    return (h.results||[]).some(r => r.platform === p && r.verdict === 'CONNECTED');
  }catch{ return false; }
}
function validCandidate(x){'''
s = s.replace('\nfunction validCandidate(x){', gate, 1)
s = s.replace("  if(p==='workana') return false;\n", "  if(p==='workana') return false;\n  if(!sessionConnected(p)) return false;\n", 1)
p.write_text(s, encoding='utf-8')
print('patched')
