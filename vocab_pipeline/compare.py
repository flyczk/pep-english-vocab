import csv, re, sys
def key(s): return re.sub(r'[^a-z0-9]+','',s.lower())
def load(p):
    rows=[]
    with open(p, encoding='utf-8-sig') as f:
        rd=csv.DictReader(f, delimiter='\t')
        for r in rd:
            if not r.get('word'): continue
            rows.append({'u':int(float(r['unit'])),'w':r['word'].strip(),'ph':(r.get('phonetic') or '').strip(),
                         'pos':(r.get('pos') or '').strip(),'m':(r.get('meaning') or '').strip()})
    return rows
A=load(sys.argv[1]); B=load(sys.argv[2])
print(f"A={len(A)} B={len(B)}")
ka={(x['u'],key(x['w'])):x for x in A}
kb={(x['u'],key(x['w'])):x for x in B}
onlyA=[v for k,v in ka.items() if k not in kb]
onlyB=[v for k,v in kb.items() if k not in ka]
print(f"\n仅A有({len(onlyA)}):", [(x['u'],x['w']) for x in onlyA])
print(f"\n仅B有({len(onlyB)}):", [(x['u'],x['w']) for x in onlyB])
phd=[(ka[k]['u'],ka[k]['w'],ka[k]['ph'],kb[k]['ph']) for k in ka if k in kb and ka[k]['ph'] and kb[k]['ph'] and ka[k]['ph']!=kb[k]['ph']]
print(f"\n音标不一致({len(phd)}):")
for r in phd: print("  U%d %-24s A=%-28s B=%s"%(r[0],r[1],r[2],r[3]))
md=[(ka[k]['u'],ka[k]['w'],ka[k]['m'],kb[k]['m']) for k in ka if k in kb and ka[k]['m'].replace('；',';')!=kb[k]['m'].replace('；',';')]
print(f"\n释义不一致({len(md)}):")
for r in md[:60]: print("  U%d %-20s A=%s || B=%s"%(r[0],r[1],r[2][:40],r[3][:40]))
