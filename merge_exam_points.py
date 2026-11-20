#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把八上 116 句现有的 grammar_point（75 个碎片标签）归并为可聚合的「考点族」。

输入：b8_sentences_full.tsv（id|lesson_id|unit|sort|en|zh|pattern|grammar_point|category|source）
输出：b8_exam_points.tsv（id|unit|en|zh|category|grammar_point|exam_point）+ 控制台统计
"""
import re
from collections import Counter, defaultdict

SRC = '/Users/jeffchen/WorkBuddy/2026-10-19-02-58-58/b8_sentences_full.tsv'
OUT = '/Users/jeffchen/WorkBuddy/2026-10-19-02-58-58/b8_exam_points.tsv'

# 归并规则：按优先级从具体到宽泛匹配 grammar_point
RULES = [
    ('复合不定代词', r'不定代词|anything|anyone|anywhere|everything|everyone|nothing|someone|something|else 用法|部分否定'),
    ('比较等级·最高级', r'最高级'),
    ('比较等级·比较级', r'比较级|同级比较|as…as'),
    ('感叹句 What/How', r'感叹'),
    ('条件句 if', r'条件句'),
    ('将来时 will / be going to', r'going to|will|将来'),
    ('情态动词 can/could 请求许可', r'Can|Could|请求'),
    ('一般过去时', r'过去时'),
    ('固定搭配与动词短语', r'搭配|动词短语|keep on|make sure|plan to|prefer|try to|use…to|want to be|love to|cut into|感官动词'),
    ('交际用语与提建议', r'交际|祝贺|建议|邀请|Would you like|Shall|How about'),
    ('名词与数量表达', r'名词|数量|量的表达|不可数'),
    ('从句（宾语/定语/状语）', r'从句|because|when|until|疑问词 \+ to do'),
    ('基础句型与其它', r'.*'),
]


def pick(gp: str, category: str, en: str) -> str:
    g = gp or ''
    for name, pat in RULES:
        if re.search(pat, g, flags=re.I):
            return name
    # 没有语法标签时，退回 category
    return {'重点考点': '基础句型与其它', '常用搭配': '固定搭配与动词短语', '经典句型': '基础句型与其它'}.get(category, '基础句型与其它')


rows = []
with open(SRC, encoding='utf-8') as f:
    for line in f:
        line = line.rstrip('\n')
        if not line.strip():
            continue
        parts = line.split('|')
        if len(parts) < 9:
            continue
        rows.append(parts)

by_point = defaultdict(list)
by_unit_point = defaultdict(Counter)
for p in rows:
    sid, lid, unit, sort, en, zh, pattern, gp, cat = p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8]
    ep = pick(gp, cat, en)
    by_point[ep].append((unit, en, zh, cat, gp))
    by_unit_point[unit][ep] += 1

print('总句数:', len(rows))
print('原 grammar_point 去重:', len({r[7] for r in rows}))
print('归并后考点族:', len(by_point))
print()
print('%-26s %s' % ('考点族', '句数'))
for ep, items in sorted(by_point.items(), key=lambda kv: -len(kv[1])):
    print('%-26s %3d' % (ep, len(items)))

print()
print('各单元 × 考点族分布：')
units = sorted(by_unit_point.keys(), key=lambda u: int(re.sub(r'\D', '', u) or 0))
eps = [ep for ep, _ in sorted(by_point.items(), key=lambda kv: -len(kv[1]))]
print('%-8s %s' % ('单元', ' '.join('%s' % e[:6] for e in eps)))
for u in units:
    print('%-8s %s' % (u, ' '.join('%6d' % by_unit_point[u].get(e, 0) for e in eps)))

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('id\tunit\ten\tzh\tcategory\tgrammar_point\texam_point\n')
    for p in rows:
        sid, lid, unit, sort, en, zh, pattern, gp, cat = p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8]
        ep = pick(gp, cat, en)
        f.write('%s\t%s\t%s\t%s\t%s\t%s\t%s\n' % (sid, unit, en, zh, cat, gp, ep))
print()
print('已写出:', OUT)
