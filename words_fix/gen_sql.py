import json, re

plan = json.load(open('words_fix/plan.json'))
def key(s): return re.sub(r'[^a-z0-9]+', '', s.lower())

# 现有 DB（用于查合并目标 id）
DB = {}
for line in open('/tmp/db_ba1.txt'):
    p = line.rstrip('\n').split('|||')
    if len(p) < 7: continue
    DB.setdefault((int(p[1]) - 81, key(p[3])), int(p[0]))

def Q(s):
    return "'" + str(s).replace("'", "''") + "'"

MERGE_BY_KEY = {
    'artificialintelligence': ('AI', 6),
    'intelligence': ('intelligence', 7),
    'familiar': ('familiar', 2),
    'space': ('outerspace', 7),
    'sciencefiction': ('scifi', 7),
    'should': ('shall', 7),
    'sour': ('hotandsoursoup', 5),
    'upto': ('liveupto', 4),
    'lining': ('silverlining', 3),
}
UNIT2LESSON = {u: 81 + u for u in range(1, 9)}
out = ["PRAGMA foreign_keys=OFF;", "BEGIN;"]

# 1) 字段修正
for u in plan['updates']:
    ent = json.dumps([{"partOfSpeech": u['pos'], "meaning": u['mean']}], ensure_ascii=False)
    out.append("UPDATE words SET word=%s, phonetic=%s, part_of_speech=%s, meaning=%s, entries=%s WHERE id=%d;" % (
        Q(u['word']), Q(u['ph']), Q(u['pos']), Q(u['mean']), Q(ent), u['id']))

# 2) 新增
for m in plan['missing']:
    ent = json.dumps([{"partOfSpeech": m['pos'], "meaning": m['mean']}], ensure_ascii=False)
    out.append("INSERT INTO words (lesson_id, word, meaning, sort_order, phonetic, part_of_speech, created_at, tts_engine, entries) "
               "VALUES (%d, %s, %s, 0, %s, %s, datetime('now'), '', %s);" % (
        UNIT2LESSON[m['unit']], Q(m['word']), Q(m['mean']), Q(m['ph']), Q(m['pos']), Q(ent)))

# 3) 合并进度 + 删除多余
merged, deleted = [], []
for e in plan['extra']:
    k = key(e['word'])
    if k in MERGE_BY_KEY:
        tw, tu = MERGE_BY_KEY[k]
        tgt = DB.get((tu, key(tw)))
        if tgt and tgt != e['id']:
            out.append("UPDATE user_word_memory_events SET word_id=%d WHERE word_id=%d;" % (tgt, e['id']))
            out.append("UPDATE word_error_reports SET word_id=%d WHERE word_id=%d;" % (tgt, e['id']))
            out.append("DELETE FROM user_word_stats WHERE word_id=%d AND user_id IN (SELECT user_id FROM user_word_stats WHERE word_id=%d);" % (e['id'], tgt))
            out.append("UPDATE user_word_stats SET word_id=%d WHERE word_id=%d;" % (tgt, e['id']))
            merged.append((e['word'], tw, tgt))
    out.append("DELETE FROM words WHERE id=%d;" % e['id'])
    deleted.append((e['id'], e['word']))

out.append("COMMIT;")
open('words_fix/fix.sql', 'w').write("\n".join(out) + "\n")
print("语句数:", len(out))
print("合并:", merged)
print("删除:", deleted)
