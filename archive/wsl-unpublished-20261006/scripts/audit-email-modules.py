import os,re
terms=re.compile(r'gmail|sendemail|resend|draft|email|mail',re.I)
count=0
for root, dirs, files in os.walk('.'):
    if any(x in root for x in ['node_modules','.git','dist']):
        continue
    if not any(root.startswith('./'+p) for p in ['worker','scripts','src','tests']):
        continue
    for f in files:
        if not f.endswith(('.js','.mjs','.ts','.tsx','.json','.md')):
            continue
        path=os.path.join(root,f)
        try:
            for i,line in enumerate(open(path,encoding='utf-8',errors='ignore'),1):
                if terms.search(line):
                    print(f'{path}:{i}:{line.strip()[:180]}')
                    count += 1
                    if count >= 220:
                        raise SystemExit
        except Exception:
            pass
