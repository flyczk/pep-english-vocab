import csv, re
def key(s): return re.sub(r'[^a-z0-9]+', '', s.lower())
ref = []
with open('ba1_reference.tsv', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f, delimiter='\t'):
        ref.append((int(r['unit']), key(r['word']), r['word']))
db = {}
for line in open('/tmp/db_after.txt'):
    p = line.rstrip('\n').split('|||')
    if len(p) < 7: continue
    db.setdefault((int(p[1]) - 81, key(p[3])), []).append(int(p[0]))
sql, miss = [], []
for i, (u, k, w) in enumerate(ref, 1):
    ids = db.get((u, k)) or []
    if not ids: miss.append(w); continue
    sql.append("UPDATE words SET sort_order=%d WHERE id=%d;" % ((u, 1000 + len(sql) % 1000) if False else (u * 1000 + sum(1 for x in ref[:i] if x[0] == u)), ids[0]))
open('/tmp/order.sql', 'w').write("\n".join(sql) + "\n")
print("排序语句", len(sql), "缺失", miss)
