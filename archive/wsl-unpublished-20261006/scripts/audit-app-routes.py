from pathlib import Path
text=Path('worker/prospecting/applications.js').read_text(encoding='utf-8',errors='ignore')
for i,line in enumerate(text.splitlines(),1):
    if 'export ' in line or 'async function' in line or 'MAX' in line or 'DIRECT' in line or 'env.' in line and ('DIRECT' in line or 'APPLICATION' in line or 'RESEND' in line):
        print(f'{i}:{line[:220]}')
