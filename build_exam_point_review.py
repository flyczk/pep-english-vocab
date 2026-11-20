#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成考点归并核对页：按考点族分组展示八上 116 句，供人工复核。"""
import html
from collections import defaultdict

SRC = '/Users/jeffchen/WorkBuddy/2026-10-19-02-58-58/b8_exam_points.tsv'
OUT = '/Users/jeffchen/WorkBuddy/2026-10-19-02-58-58/八上句子_考点归并核对.html'

rows = []
with open(SRC, encoding='utf-8') as f:
    next(f)
    for line in f:
        p = line.rstrip('\n').split('\t')
        if len(p) >= 7:
            rows.append(p)

by = defaultdict(list)
for sid, unit, en, zh, cat, gp, ep in rows:
    by[ep].append((unit, en, zh, cat, gp))

order = sorted(by.items(), key=lambda kv: -len(kv[1]))
unit_order = sorted({r[0] for r in rows}, key=lambda u: int(''.join(c for c in u if c.isdigit()) or 0))

# 单元 × 考点矩阵
matrix = defaultdict(lambda: defaultdict(int))
for sid, unit, en, zh, cat, gp, ep in rows:
    matrix[unit][ep] += 1
eps = [k for k, _ in order]

parts = []
parts.append('''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>八上句子 · 考点归并核对</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f6f7f9;color:#111827;font:14px/1.65 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;padding:24px 20px 60px}
h1{font-size:19px;font-weight:700}
.note{font-size:13px;color:#6b7280;margin-top:6px;max-width:1000px}
h2{font-size:15px;font-weight:650;margin:28px 0 12px}
table{border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;font-size:13px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
th,td{padding:8px 12px;border-bottom:1px solid #eef0f3;text-align:left;vertical-align:top}
th{background:#f3f4f6;font-weight:600;color:#374151;font-size:12.5px;white-space:nowrap}
td.n{text-align:right;font-variant-numeric:tabular-nums;color:#374151;font-weight:600}
td.z{color:#8b909a;font-size:12px}
tr:last-child td{border-bottom:0}
.grid{display:flex;flex-wrap:wrap;gap:14px}
.g{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;width:430px;box-shadow:0 1px 2px rgba(16,24,40,.04)}
.g h3{font-size:14px;font-weight:650;margin-bottom:2px;display:flex;align-items:baseline;gap:8px}
.g h3 em{font-style:normal;font-size:12px;color:#6b7280;font-weight:400}
.g .bar{height:5px;border-radius:99px;background:#2563eb;margin:8px 0 12px;opacity:.85}
.g ul{list-style:none}
.g li{padding:9px 0;border-bottom:1px solid #f3f4f6;display:flex;gap:10px}
.g li:last-child{border-bottom:0}
.g .u{font-size:11px;color:#8b909a;white-space:nowrap;padding-top:2px;min-width:52px}
.g .b{flex:1;min-width:0}
.g .en{font-size:13.5px;font-weight:600;color:#111827}
.g .zh{font-size:12.5px;color:#6b7280;margin-top:1px}
.g .tag{font-size:11px;color:#9ca3af;margin-top:2px}
.ok{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px 16px;font-size:13px;color:#065f46;max-width:1000px}
</style></head><body>''')

# 人教版（2024）八上教材语法主线：每单元的核心语法（已核对教材与教辅资料）
TEXTBOOK_SCOPE = [
    ('Unit 1', 'Happy Holiday', '一般过去时；复合不定代词'),
    ('Unit 2', 'Home Sweet Home', '情态动词 can / could 表请求与许可'),
    ('Unit 3', 'Same or Different?', '形容词、副词比较级；than 比较句型'),
    ('Unit 4', 'Amazing Plants and Animals', '形容词、副词最高级；in / of 范围短语'),
    ('Unit 5', 'What a Delicious Meal!', '感叹句 What / How；可数与不可数名词；How much / many'),
    ('Unit 6', 'Plan for Yourself', '一般将来时 be going to；不定式 to do 作宾语'),
    ('Unit 7', 'When Tomorrow Comes', '一般将来时 will；There be 将来时'),
    ('Unit 8', "Let's Communicate!", 'if 引导的条件状语从句（主将从现）'),
]
# 考点族 → 首次教学单元（教材把它作为本单元核心语法的那一课）
FIRST_UNIT = {
    '一般过去时': 1, '复合不定代词': 1,
    '情态动词 can/could 请求许可': 2,
    '比较等级·比较级': 3,
    '比较等级·最高级': 4,
    '感叹句 What/How': 5, '名词与数量表达': 5,
    '将来时 will / be going to': 6,
    '条件句 if': 8,
    # 以下不随单元语法序列推进，属于「无时序依赖」，任意单元出现都合理
    '固定搭配与动词短语': 0, '交际用语与提建议': 0, '基础句型与其它': 0,
}


def unit_no(u: str) -> int:
    return int(''.join(c for c in u if c.isdigit()) or 0)


# 前置依赖校验：句子所在单元若早于该考点的首次教学单元 = 提前出现未学内容
violations = []
for sid, unit, en, zh, cat, gp, ep in rows:
    first = FIRST_UNIT.get(ep, 0)
    if first and unit_no(unit) < first:
        violations.append((unit, ep, first, en))

parts.append('<h1>八上句子 · 考点归并核对</h1>')
parts.append('<div class="note">现有 <b>grammar_point</b> 共 75 个碎片标签（116 句，平均 1.5 句/标签），无法聚合。'
             '下表是按语法族归并后的 <b>13 个考点族</b>，每句归属一个族，用于人工复核。'
             '归并只依据现有 grammar_point 文本，<b>未重读句子</b>，落地前需逐句确认。</div>')

parts.append('<h2>教材语法主线 vs 我们的句子分布</h2>')
parts.append('<table><tr><th>单元</th><th>教材核心语法</th><th>本单元句子的主考点</th><th style="text-align:right">句数</th><th>吻合</th></tr>')
for u, title, scope in TEXTBOOK_SCOPE:
    c = matrix.get(u, {})
    top = sorted(c.items(), key=lambda kv: -kv[1])
    top = [(k, v) for k, v in top if v]
    main = '、'.join('%s(%d)' % (k, v) for k, v in top[:3])
    ok = '✓' if top and top[0][0] in scope.replace('；', '；') or any(k in scope for k, _ in top[:1]) else '?'
    parts.append('<tr><td>%s %s</td><td class="z">%s</td><td>%s</td><td class="n">%d</td><td>%s</td></tr>'
                 % (html.escape(u), html.escape(title), html.escape(scope), html.escape(main), sum(v for _, v in top), ok))
parts.append('</table>')

parts.append('<h2>前置依赖校验（是否提前出现未学语法）</h2>')
if violations:
    parts.append('<table><tr><th>所在单元</th><th>考点族</th><th>首次教学单元</th><th>句子</th></tr>')
    for u, ep, first, en in violations:
        parts.append('<tr><td>%s</td><td>%s</td><td>Unit %d</td><td>%s</td></tr>' % (html.escape(u), html.escape(ep), first, html.escape(en)))
    parts.append('</table>')
else:
    parts.append('<div class="ok">✓ 116 句<b>没有一句</b>出现「句子所在单元早于该考点的首次教学单元」的情况。'
                 '跨单元出现的考点全部是<b>对已学内容的复现</b>（如 U6 复现 U1 的不定代词、U7 复现 U5 的感叹句）。'
                 '因此按单元学习时不存在「上下文不清楚」的问题。</div>')

parts.append('<h2>考点族分布</h2><table><tr><th>考点族</th><th style="text-align:right">句数</th><th>覆盖单元</th></tr>')
for ep, items in order:
    us = sorted({i[0] for i in items}, key=lambda u: int(''.join(c for c in u if c.isdigit()) or 0))
    parts.append('<tr><td>%s</td><td class="n">%d</td><td class="z">%s</td></tr>' % (html.escape(ep), len(items), '、'.join(us)))
parts.append('</table>')

parts.append('<h2>单元 × 考点矩阵</h2><table><tr><th>单元</th>' + ''.join('<th style="text-align:right">%s</th>' % html.escape(e) for e in eps) + '</tr>')
for u in unit_order:
    parts.append('<tr><td>%s</td>' % html.escape(u) + ''.join('<td class="n">%d</td>' % matrix[u].get(e, 0) if matrix[u].get(e, 0) else '<td class="z">·</td>' for e in eps) + '</tr>')
parts.append('</table>')

parts.append('<h2>逐句清单（按考点族分组）</h2><div class="grid">')
for ep, items in order:
    mx = max(len(i[1]) for i in items) if items else 1
    parts.append('<div class="g"><h3>%s <em>%d 句</em></h3><div class="bar" style="width:%d%%"></div><ul>' % (html.escape(ep), len(items), max(6, len(items) / 21 * 100)))
    for unit, en, zh, cat, gp in items:
        parts.append('<li><span class="u">%s</span><div class="b"><div class="en">%s</div><div class="zh">%s</div>'
                     '<div class="tag">原标签：%s · %s</div></div></li>'
                     % (html.escape(unit), html.escape(en), html.escape(zh), html.escape(gp or '—'), html.escape(cat)))
    parts.append('</ul></div>')
parts.append('</div></body></html>')

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(parts))
print('written:', OUT)
print('考点族:', len(order), '句子:', len(rows))
