import csv, re, json
def key(s): return re.sub(r'[^a-z0-9]+','',s.lower())
ref=[]
with open('ba1_reference.tsv',encoding='utf-8-sig') as f:
    for r in csv.DictReader(f,delimiter='\t'):
        ref.append({'u':int(r['unit']),'w':r['word'].strip(),'ph':r['phonetic'].strip(),'pos':r['pos'].strip(),'m':r['meaning'].strip(),'k':key(r['word'])})
before={}
for line in open('words_ba1_raw.txt'):
    p=line.rstrip('\n').split('|||')
    if len(p)<6: continue
    before.setdefault((int(p[0])-81,key(p[2])),{'w':p[2],'ph':p[3],'pos':p[4],'m':p[5]})
ph=[];me=[];wo=[]
for r in ref:
    b=before.get((r['u'],r['k']))
    if not b: continue
    if b['ph'].strip() and b['ph'].strip()!=r['ph']: ph.append((r['u'],b['w'],b['ph'],r['ph']))
    if b['m'].strip()!=r['m']: me.append((r['u'],b['w'],b['m'],r['m']))
    if b['w'].strip()!=r['w']: wo.append((r['u'],r['w'],b['w'],r['w']))
print('词形',len(wo),'音标',len(ph),'释义',len(me))
def tbl(rows,n=24):
    out=['| 单元 | 词条 | 原值 | 正确值 |','|---|---|---|---|']
    for u,w,a,b in rows[:n]: out.append('| U%d | %s | %s | %s |'%(u,w,a,b))
    return '\n'.join(out)
open('words_fix/examples.md','w').write(
 "# 词形\n"+tbl(wo,40)+"\n\n# 音标\n"+tbl(ph,40)+"\n\n# 释义\n"+tbl(me,30))
print(tbl(wo,12)); print(); print(tbl(ph,12)); print(); print(tbl(me,8))
