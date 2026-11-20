import csv, json, re, subprocess, sys, os

def key(s): return re.sub(r'[^a-z0-9]+','',s.lower())
def Q(s): return "'" + str(s).replace("'","''") + "'"

def dump(lessons, out):
    ids=",".join(str(i) for i in lessons)
    cmd=("ssh web \"sqlite3 -separator '|||' /var/www/words/server/data/app.db "
         "\\\"SELECT id,lesson_id,sort_order,word,phonetic,part_of_speech,meaning FROM words "
         f"WHERE lesson_id IN ({ids}) ORDER BY lesson_id,id;\\\"\"")
    r=subprocess.run(cmd, shell=True, capture_output=True, text=True)
    open(out,'w').write(r.stdout)
    return out

def main(tsv, base_lesson, n_units, outdir, rename_json=None):
    os.makedirs(outdir, exist_ok=True)
    lessons=list(range(base_lesson, base_lesson+n_units))
    dump_path=os.path.join(outdir,'db_before.txt'); dump(lessons, dump_path)
    REF=[]
    for r in csv.DictReader(open(tsv,encoding='utf-8-sig'),delimiter='\t'):
        if not r.get('word'): continue
        REF.append({'unit':int(float(r['unit'])),'word':r['word'].strip(),'ph':(r['phonetic'] or '').strip(),
                    'pos':(r['pos'] or '').strip(),'mean':(r['meaning'] or '').strip(),'k':key(r['word'])})
    DB=[]
    for line in open(dump_path):
        p=line.rstrip('\n').split('|||')
        if len(p)<7: continue
        DB.append({'id':int(p[0]),'unit':int(p[1])-base_lesson+1,'word':p[3],'ph':p[4],'pos':p[5],'mean':p[6],'k':key(p[3])})
    RENAME=json.load(open(rename_json)) if rename_json else {}
    RENAME={key(a):key(b) for a,b in RENAME.items()}
    used=set(); match={}
    for r in REF:
        c=[d for d in DB if d['k']==r['k'] and d['id'] not in used]
        same=[d for d in c if d['unit']==r['unit']]
        pick=(same or c or [None])[0]
        if pick: match[id(r)]=pick; used.add(pick['id'])
    for d in DB:
        if d['id'] in used: continue
        rk=RENAME.get(d['k'])
        if not rk: continue
        for r in REF:
            if r['k']==rk and id(r) not in match:
                match[id(r)]=d; used.add(d['id']); break
    missing=[r for r in REF if id(r) not in match]
    extra=[d for d in DB if d['id'] not in used]
    upd=[]; stats={'word':0,'ph':0,'mean':0,'pos':0}
    for r in REF:
        d=match.get(id(r))
        if not d: continue
        diffs=[]
        if d['word']!=r['word']: diffs.append(('word',d['word'],r['word'])); stats['word']+=1
        if r['ph'] and (d['ph'] or '').strip()!=r['ph']: diffs.append(('phonetic',d['ph'],r['ph'])); stats['ph']+=1
        if (r['mean'] and (d['mean'] or '').strip()!=r['mean']): diffs.append(('meaning',d['mean'],r['mean'])); stats['mean']+=1
        if r['pos'] and (d['pos'] or '').strip()!=r['pos']: diffs.append(('pos',d['pos'],r['pos'])); stats['pos']+=1
        if diffs: upd.append((r,d,diffs))
    print(f"教材{len(REF)} 库{len(DB)} | 缺{len(missing)} 多{len(extra)} | 词形{stats['word']} 音标{stats['ph']} 释义{stats['mean']} 词性{stats['pos']}")
    print("缺失:", [f"U{r['unit']}:{r['word']}" for r in missing])
    print("多余:", [f"U{d['unit']}:{d['word']}(id{d['id']})" for d in extra])
    json.dump({'missing':[{k:r[k] for k in ('unit','word','ph','pos','mean')} for r in missing],
               'extra':[{'id':d['id'],'unit':d['unit'],'word':d['word']} for d in extra]},
              open(os.path.join(outdir,'plan.json'),'w'), ensure_ascii=False, indent=1)
    return REF, DB, match, missing, extra, upd, base_lesson

if __name__=='__main__':
    main(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5] if len(sys.argv)>5 else None)
