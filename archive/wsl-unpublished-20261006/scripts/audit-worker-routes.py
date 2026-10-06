from pathlib import Path
text=Path('worker/index.js').read_text(encoding='utf-8',errors='ignore')
for i,line in enumerate(text.splitlines(),1):
    l=line.lower()
    if '/ops/' in line or 'outreach' in l or 'direct' in l or 'resend' in l or 'cron' in l:
        print(f'{i}:{line[:240]}')
