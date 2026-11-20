import csv, re, json, difflib, sys

def key(s):
    return re.sub(r'[^a-z0-9]+', '', s.lower())

REF = []
with open('ba1_reference.tsv', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f, delimiter='\t'):
        REF.append({'unit': int(r['unit']), 'word': r['word'].strip(), 'ph': r['phonetic'].strip(),
                    'pos': r['pos'].strip(), 'mean': r['meaning'].strip(), 'k': key(r['word'])})

DB = []
for line in open('/tmp/db_ba1.txt'):
    p = line.rstrip('\n').split('|||')
    if len(p) < 7: continue
    DB.append({'id': int(p[0]), 'unit': int(p[1]) - 81, 'sort': int(p[2] or 0), 'word': p[3],
               'ph': p[4], 'pos': p[5], 'mean': p[6], 'k': key(p[3])})

# 明确的改名映射（保留 id，保住学习记录）：db_key -> ref_key
RENAME = {
    'arrive': 'arrival',            # U2
    'papercut': 'papercutting',
    'humor': 'humour',
    'kilometre': 'km',
    'millimetre': 'mm',
    'kilogram': 'kg',
    'vancouver': 'chicago',
    'pine': 'guestgreetingpine',
    'seatle': 'california',
    'alexander': 'alexandergarden',
}

used_db = set()
plan = []   # (action, ref_or_db...)
matched_ref = {}

# 1) 精确 key 匹配（同单元优先）
for r in REF:
    cands = [d for d in DB if d['k'] == r['k'] and d['id'] not in used_db]
    same = [d for d in cands if d['unit'] == r['unit']]
    pick = (same or cands or [None])[0]
    if pick:
        matched_ref[id(r)] = pick
        used_db.add(pick['id'])

# 2) 改名映射匹配
for d in DB:
    if d['id'] in used_db: continue
    rk = RENAME.get(d['k'])
    if not rk: continue
    for r in REF:
        if r['k'] == rk and id(r) not in matched_ref:
            matched_ref[id(r)] = d
            used_db.add(d['id'])
            break

missing = [r for r in REF if id(r) not in matched_ref]
extra   = [d for d in DB if d['id'] not in used_db]

print("== 需新增（教材有，库无）==")
for r in missing: print(f"  U{r['unit']}\t{r['word']}\t{r['ph']}")
print(f"  合计 {len(missing)}")

print("\n== 库中多余（教材无）==")
for d in extra: print(f"  U{d['unit']}\tid={d['id']}\t{d['word']}")
print(f"  合计 {len(extra)}")

print("\n== 字段差异统计 ==")
ph_bad = mean_bad = pos_bad = word_bad = 0
rows = []
for r in REF:
    d = matched_ref.get(id(r))
    if not d: continue
    diffs = []
    if d['word'] != r['word']:
        diffs.append(('word', d['word'], r['word'])); word_bad += 1
    if (d['ph'] or '').strip() != r['ph']:
        diffs.append(('phonetic', d['ph'], r['ph'])); ph_bad += 1
    if (d['mean'] or '').strip() != r['mean']:
        diffs.append(('meaning', d['mean'], r['mean'])); mean_bad += 1
    if (d['pos'] or '').strip() != r['pos']:
        diffs.append(('pos', d['pos'], r['pos'])); pos_bad += 1
    if diffs:
        rows.append((r, d, diffs))
print(f"  词形 {word_bad} / 音标 {ph_bad} / 释义 {mean_bad} / 词性 {pos_bad}")

json.dump({'missing': [{k: r[k] for k in ('unit','word','ph','pos','mean')} for r in missing],
           'extra': [{'id': d['id'], 'unit': d['unit'], 'word': d['word']} for d in extra],
           'updates': [{'id': d['id'], 'unit': r['unit'], 'word': r['word'], 'old_word': d['word'],
                        'ph': r['ph'], 'pos': r['pos'], 'mean': r['mean'],
                        'diffs': [list(x) for x in dfs]} for r, d, dfs in rows]},
          open('words_fix/plan.json', 'w'), ensure_ascii=False, indent=1)
print("\nplan.json 已生成")
