#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成：
  1) update_exam_point.sql  —— sentences 加 exam_point / is_review 并打标签
  2) sentence_drills.sql    —— 按考点预生成「挖空填空」针对性练习题

挖空规则刻意保守：只挖词表内/正则可精确命中的词，挖不到就不生成该题（宁缺毋错）。
"""
import re
import sqlite3
from collections import Counter

BASE = '/Users/jeffchen/WorkBuddy/2026-10-19-02-58-58/'
SRC = BASE + 'b8_exam_points.tsv'

# 考点族 → 首次教学单元（教材把它作为本单元核心语法的那一课）
FIRST_UNIT = {
    '一般过去时': 1, '复合不定代词': 1,
    '情态动词 can/could 请求许可': 2,
    '比较等级·比较级': 3,
    '比较等级·最高级': 4,
    '感叹句 What/How': 5, '名词与数量表达': 5,
    '将来时 will / be going to': 6,
    '条件句 if': 8,
}

# ---- 挖空词表（只挖这些词，避免误伤）----
CMP = ['taller', 'shorter', 'longer', 'bigger', 'smaller', 'faster', 'slower', 'higher', 'lower',
       'younger', 'older', 'stronger', 'weaker', 'smarter', 'quieter', 'louder', 'funnier',
       'heavier', 'thinner', 'nicer', 'later', 'earlier', 'better', 'worse', 'more', 'less',
       'farther', 'further', 'friendlier', 'cuter', 'braver', 'cleaner', 'safer', 'cheaper',
       'easier', 'harder', 'larger', 'warmer', 'cooler', 'brighter', 'closer', 'wider']
SUP = ['tallest', 'shortest', 'longest', 'biggest', 'smallest', 'fastest', 'slowest', 'highest',
       'lowest', 'youngest', 'oldest', 'strongest', 'weakest', 'smartest', 'quietest', 'loudest',
       'funniest', 'heaviest', 'thinnest', 'nicest', 'best', 'worst', 'most', 'least', 'cutest',
       'cleanest', 'safest', 'cheapest', 'easiest', 'hardest', 'largest', 'warmest', 'closest']
PAST = ['did', "didn't", 'was', 'were', 'went', 'saw', 'ate', 'took', 'had', 'met', 'tried',
        'stayed', 'visited', 'enjoyed', 'loved', 'tasted', 'felt', 'got', 'came', 'bought',
        'rode', 'heard', 'left', 'made', 'said', 'told', 'thought', 'wrote', 'ran', 'swam',
        'drank', 'flew', 'gave', 'knew', 'sang', 'sat', 'slept', 'spoke', 'stood', 'taught', 'won']
INDEF = ['anything', 'anyone', 'anywhere', 'everything', 'everyone', 'everywhere',
         'something', 'someone', 'somewhere', 'nothing', 'nobody', 'nowhere']

# 固定搭配：grammar_point 里带了具体搭配词的，按词挖空（没有具体词的宁可不出题）
COLLOC = {
    'want to be': ['want to be'],
    'use…to do 结构': ['use'],
    'try to do': ['try to'],
    'prefer doing': ['prefer'],
    'plan to do': ['plan to'],
    'make sure': ['make sure'],
    'love to do': ['love to'],
    'keep on doing': ['keep on'],
    'cut into': ['cut'],
    '感官动词 + like': ['like'],
}

# 考点族 → 挖空候选（按优先级）
RULES = {
    '复合不定代词': [INDEF],
    '一般过去时': [PAST],
    '情态动词 can/could 请求许可': [['Can', 'Could', 'can', 'could']],
    '比较等级·比较级': [CMP],
    '比较等级·最高级': [SUP],
    '感叹句 What/How': [['What', 'How']],
    '将来时 will / be going to': [['will', "won't", 'Will'], ['going to', 'am going to', 'is going to', 'are going to']],
    '名词与数量表达': [['How much', 'How many', 'how much', 'how many']],
    # 条件句单独处理：挖 If + 主句 will（主将从现，正是考点）
}

HINTS = {
    '复合不定代词': 'some- 类多用于肯定句；any- 类多用于否定句和疑问句',
    '一般过去时': '过去时间发生的动作用过去式；出现 did / didn\'t 后动词要变回原形',
    '情态动词 can/could 请求许可': 'Could 不是过去式，是比 Can 更委婉礼貌的请求',
    '比较等级·比较级': '两者比较用「比较级 + than」；多音节词前加 more',
    '比较等级·最高级': '三者及以上用「the + 最高级」，常接 in / of 范围',
    '感叹句 What/How': 'What 修饰名词，How 修饰形容词或副词',
    '将来时 will / be going to': 'be going to 强调计划与意图，will 强调预见与意愿',
    '名词与数量表达': 'How many 接可数名词复数，How much 接不可数名词',
    '条件句 if': '主将从现：if 从句用一般现在时，主句用 will + 动词原形',
}


def un(u: str) -> int:
    return int(''.join(c for c in u if c.isdigit()) or 0)


def cloze(en: str, ep: str, gp: str = ''):
    """返回 (prompt, answers) 或 None"""
    if ep == '固定搭配与动词短语':
        for w in COLLOC.get(gp.strip(), []):
            m = re.search(r'\b' + re.escape(w) + r'\b', en)
            if m:
                return en[:m.start()] + '____' + en[m.end():], [m.group(0)]
        return None

    if ep == '条件句 if':
        m1 = re.search(r'\b(If|if)\b', en)
        # 只挖完整的 will / won't；'ll 是缩写，挖掉会出现 "I____" 这种畸形空，跳过
        m2 = re.search(r"\b(will|won't)\b", en)
        if not m1:
            return None
        picks = [(m1.start(), m1.end(), m1.group(1))]
        if m2 and m2.start() != m1.start():
            picks.append((m2.start(), m2.end(), m2.group(1)))
        picks.sort()
        out, last = [], 0
        ans = []
        for s, e, w in picks:
            out.append(en[last:s])
            out.append('____')
            last = e
            ans.append(w)
        out.append(en[last:])
        return ''.join(out), ans

    for group in RULES.get(ep, []):
        words = sorted(set(group), key=len, reverse=True)
        pat = r'\b(' + '|'.join(re.escape(w) for w in words) + r')\b'
        m = re.search(pat, en)
        if m:
            prompt = en[:m.start()] + '____' + en[m.end():]
            return prompt, [m.group(1)]
    return None


def esc(s: str) -> str:
    return s.replace("'", "''")


rows = []
with open(SRC, encoding='utf-8') as f:
    next(f)
    for line in f:
        p = line.rstrip('\n').split('\t')
        if len(p) >= 7:
            rows.append(p)

# ---------- 1) 标签更新 SQL ----------
lines = []
lines.append("ALTER TABLE sentences ADD COLUMN exam_point TEXT;")
lines.append("ALTER TABLE sentences ADD COLUMN is_review INTEGER NOT NULL DEFAULT 0;")
review_cnt = 0
for sid, unit, en, zh, cat, gp, ep in rows:
    first = FIRST_UNIT.get(ep, 0)
    is_rev = 1 if first and un(unit) > first else 0
    review_cnt += is_rev
    lines.append("UPDATE sentences SET exam_point = '%s', is_review = %d WHERE id = '%s';"
                 % (esc(ep), is_rev, esc(sid)))
with open(BASE + 'update_exam_point.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

# ---------- 2) 练习题 SQL ----------
lines = []
lines.append("""CREATE TABLE IF NOT EXISTS sentence_drills (
  id TEXT PRIMARY KEY,
  sentence_id TEXT NOT NULL,
  exam_point TEXT NOT NULL,
  kind TEXT NOT NULL,
  prompt TEXT NOT NULL,
  answer TEXT NOT NULL,
  hint TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);""")
lines.append("CREATE INDEX IF NOT EXISTS idx_drills_point ON sentence_drills(exam_point);")
lines.append("DELETE FROM sentence_drills;")

made, skipped = 0, Counter()
per_point = Counter()
preview = []
for i, (sid, unit, en, zh, cat, gp, ep) in enumerate(rows):
    r = cloze(en, ep, gp)
    if not r:
        skipped[ep] += 1
        continue
    prompt, answers = r
    did = 'dr_%s' % sid
    lines.append(
        "INSERT INTO sentence_drills (id, sentence_id, exam_point, kind, prompt, answer, hint, sort_order) "
        "VALUES ('%s','%s','%s','cloze','%s','%s','%s',%d);"
        % (esc(did), esc(sid), esc(ep), esc(prompt), esc('|'.join(answers)),
           esc(HINTS.get(ep, '')), i))
    made += 1
    per_point[ep] += 1
    preview.append((ep, prompt, ' / '.join(answers), en))

with open(BASE + 'sentence_drills.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

print('句子总数: %d  复现句(温故): %d' % (len(rows), review_cnt))
print('生成练习题: %d  未生成: %d' % (made, sum(skipped.values())))
print()
print('按考点生成题数:')
for ep, c in sorted(per_point.items(), key=lambda kv: -kv[1]):
    print('  %-26s %3d 题  (未生成 %d)' % (ep, c, skipped.get(ep, 0)))
print()
print('抽样预览（每考点 2 条）:')
seen = Counter()
for ep, prompt, ans, en in preview:
    if seen[ep] < 2:
        seen[ep] += 1
        print('  [%s]' % ep)
        print('    原句: %s' % en)
        print('    题目: %s' % prompt)
        print('    答案: %s' % ans)
