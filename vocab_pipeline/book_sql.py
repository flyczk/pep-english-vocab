import csv, json, re, sys, os
def key(s): return re.sub(r'[^a-z0-9]+','',s.lower())
def Q(s): return "'" + str(s).replace("'","''") + "'"

def run(tsv, base_lesson, n_units, outdir, rename_json=None, merge_json=None):
    REF=[]
    for r in csv.DictReader(open(tsv,encoding='utf-8-sig'),delimiter='\t'):
        if not r.get('word'): continue
        REF.append({'unit':int(float(r['unit'])),'word':r['word'].strip(),'ph':(r['phonetic'] or '').strip(),
                    'pos':(r['pos'] or '').strip(),'mean':(r['meaning'] or '').strip(),'k':key(r['word'])})
    DB=[]
    for line in open(os.path.join(outdir,'db_before.txt')):
        p=line.rstrip('\n').split('|||')
        if len(p)<7: continue
        DB.append({'id':int(p[0]),'unit':int(p[1])-base_lesson+1,'word':p[3],'ph':p[4],'pos':p[5],'mean':p[6],'k':key(p[3])})
    RENAME={key(a):key(b) for a,b in (json.load(open(rename_json)).items() if rename_json else [])}
    MERGE={key(a):key(b) for a,b in (json.load(open(merge_json)).items() if merge_json else [])}
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
    byk={}
    for r in REF: byk.setdefault(r['k'],[]).append(r)
    sql=["PRAGMA foreign_keys=OFF;","BEGIN;"]
    nupd=0
    for r in REF:
        d=match.get(id(r))
        if not d: continue
        ent=json.dumps([{"partOfSpeech":r['pos'],"meaning":r['mean']}],ensure_ascii=False)
        if (d['word'],(d['ph'] or '').strip(),(d['pos'] or '').strip(),(d['mean'] or '').strip())==(r['word'],r['ph'],r['pos'],r['mean']):
            continue
        ph = r['ph'] if r['ph'] else (d['ph'] or '')
        sql.append("UPDATE words SET word=%s, phonetic=%s, part_of_speech=%s, meaning=%s, entries=%s WHERE id=%d;"%(
            Q(r['word']),Q(ph),Q(r['pos']),Q(r['mean']),Q(ent),d['id'])); nupd+=1
    for m in missing:
        ent=json.dumps([{"partOfSpeech":m['pos'],"meaning":m['mean']}],ensure_ascii=False)
        sql.append("INSERT INTO words (lesson_id,word,meaning,sort_order,phonetic,part_of_speech,created_at,tts_engine,entries) "
                   "VALUES (%d,%s,%s,0,%s,%s,datetime('now'),'',%s);"%(base_lesson+m['unit']-1,Q(m['word']),Q(m['mean']),Q(m['ph']),Q(m['pos']),Q(ent)))
    for e in extra:
        target=None
        mk=MERGE.get(e['k'])
        if mk and byk.get(mk):
            tr=byk[mk][0]
            for d2 in DB:
                if d2['k']==mk and d2['id']!=e['id']:
                    target=d2['id']; break
        if target:
            sql.append("UPDATE user_word_memory_events SET word_id=%d WHERE word_id=%d;"%(target,e['id']))
            sql.append("UPDATE word_error_reports SET word_id=%d WHERE word_id=%d;"%(target,e['id']))
            sql.append("DELETE FROM user_word_stats WHERE word_id=%d AND user_id IN (SELECT user_id FROM user_word_stats WHERE word_id=%d);"%(e['id'],target))
            sql.append("UPDATE user_word_stats SET word_id=%d WHERE word_id=%d;"%(target,e['id']))
        else:
            sql.append("DELETE FROM user_word_stats WHERE word_id=%d;"%e['id'])
            sql.append("DELETE FROM user_word_memory_events WHERE word_id=%d;"%e['id'])
            sql.append("DELETE FROM word_error_reports WHERE word_id=%d;"%e['id'])
        sql.append("DELETE FROM words WHERE id=%d;"%e['id'])
    # 重排 sort_order
    cnt={}
    order=[]
    for r in REF:
        cnt[r['unit']]=cnt.get(r['unit'],0)+1
        ids=[d['id'] for d in DB if d['k']==r['k'] and d['unit']==r['unit']]
        if ids: order.append((r['unit']*1000+cnt[r['unit']], ids[0]))
    for so,i in order:
        sql.append("UPDATE words SET sort_order=%d WHERE id=%d;"%(so,i))
    sql.append("COMMIT;")
    open(os.path.join(outdir,'fix.sql'),'w').write("\n".join(sql)+"\n")
    print(f"教材{len(REF)} 库{len(DB)} 更新{nupd} 新增{len(missing)} 删除{len(extra)} 语句{len(sql)}")

if __name__=='__main__':
    run(sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),sys.argv[4],sys.argv[5] if len(sys.argv)>5 else None, sys.argv[6] if len(sys.argv)>6 else None)
