#!/usr/bin/env python3
"""用 ASR 词级时间戳把 24 句对齐到官方音频，并逐句做内容校验。
思路：ASR 词序列 vs 24 句参考词序列 做 SequenceMatcher 对齐 → 反推每句起止时间。
"""
import json, re, difflib, sys

ASR = '/tmp/u1_asr.json'

SENTENCES = [
 (19,139,"Today was our first day to visit Moscow."),
 (20,140,"The weather was fine and everyone felt excited to visit some famous places in Russia."),
 (21,141,"In the morning, we went to the Victory Museum."),
 (22,142,"The Russian people built this museum to remember their fight against the Nazis during World War II."),
 (23,143,"As we walked through the halls, the tour guide told us stories about the war."),
 (24,144,'In one hall, I saw an artwork with thousands of glass "tears" falling down.'),
 (25,145,"It reminds us that war is terrible and peace does not come easily."),
 (26,146,"We should not forget that."),
 (27,147,"At noon, we had lunch at a restaurant near the park."),
 (28,148,"I liked the ice cream there, so I ate a lot of it."),
 (29,149,"But, during dinner, I didn't feel like eating because I felt sick."),
 (30,150,"So now, I just want to get a good night's sleep."),
 (31,151,"It rained last night, so this morning the air was fresh and cool."),
 (32,152,"I felt much better today."),
 (33,153,"We took the Moscow Metro to travel around."),
 (34,154,"The metro stations are really beautiful."),
 (35,155,"Sometimes I felt like I was walking inside a palace."),
 (36,156,"After that, we went to Red Square."),
 (37,157,"It was fantastic!"),
 (38,158,"In the afternoon, we arrived at a school and met a group of Russian students."),
 (39,159,"We played games and soon became friends."),
 (40,160,"Later, someone took out his accordion, and soon everyone got together to sing and dance."),
 (41,161,"We were so happy that we didn't notice the time."),
 (42,162,"It was such a good experience!"),
]

def words_of(text):
    text = text.lower().replace('’', "'")
    return [w for w in re.findall(r"[a-z0-9']+", text) if w]

# ---- 读 ASR 词（过滤纯标点/空） ----
d = json.load(open(ASR))
asr = []
for s in d['transcription']:
    t = s.get('text', '')
    if not words_of(t):
        continue
    off = s.get('offsets', {})
    st, en = off.get('from', 0) / 1000.0, off.get('to', 0) / 1000.0
    for w in words_of(t):
        asr.append({'w': w, 'start': st, 'end': en})

print(f'ASR 词数: {len(asr)}  音频时长: {asr[-1]["end"]:.1f}s')

# ---- 参考词序列（带句子归属） ----
ref = []
for (so, sid, en) in SENTENCES:
    ws = words_of(en)
    for i, w in enumerate(ws):
        ref.append({'w': w, 'so': so, 'id': sid, 'idx': i, 'first': i == 0, 'last': i == len(ws) - 1})

# ---- SequenceMatcher 对齐 ----
sm = difflib.SequenceMatcher(a=[x['w'] for x in asr], b=[x['w'] for x in ref], autojunk=False)
mapping = {}  # ref index -> asr index
for a0, b0, size in sm.get_matching_blocks():
    for k in range(size):
        mapping[b0 + k] = a0 + k

print(f'对上的参考词: {len(mapping)}/{len(ref)}')

# ---- 反推每句起止 ----
segs = []
for (so, sid, en) in SENTENCES:
    ridx = [i for i, r in enumerate(ref) if r['so'] == so]
    hit = [mapping[i] for i in ridx if i in mapping]
    if len(hit) < 2:
        segs.append({'sort_order': so, 'id': sid, 'en': en, 'start': None, 'end': None, 'asr_text': '', 'sim': 0.0, 'hits': len(hit)})
        continue
    a_first, a_last = min(hit), max(hit)
    st = asr[a_first]['start']
    en_t = asr[a_last]['end']
    asr_text = ' '.join(x['w'] for x in asr[a_first:a_last + 1])
    s1 = difflib.SequenceMatcher(a=words_of(en), b=asr_text.split(), autojunk=False).ratio()
    segs.append({'sort_order': so, 'id': sid, 'en': en, 'start': round(st, 3), 'end': round(en_t, 3),
                 'asr_text': asr_text, 'sim': round(s1, 3), 'hits': len(hit),
                 'coverage': round(len(hit) / len(ridx), 3)})

print('\n=== 逐句对齐结果 ===')
print(f'{"序":>3} {"起-止":>16} {"时长":>6} {"匹配率":>7} {"相似度":>7}  句子')
bad = []
for s in segs:
    if s['start'] is None:
        print(f"{s['sort_order']:>3} {'FAIL':>16}  命中{s['hits']}  {s['en'][:50]}")
        bad.append(s); continue
    dur = s['end'] - s['start']
    flag = ''
    if s['sim'] < 0.85 or s['coverage'] < 0.9:
        flag = ' <<<'
        bad.append(s)
    print(f"{s['sort_order']:>3} {s['start']:>7.2f}-{s['end']:>7.2f} {dur:>6.2f} {s['coverage']:>7.2f} {s['sim']:>7.2f}  {s['en'][:52]}{flag}")

print(f'\n可疑段: {len(bad)}')
for s in bad:
    print(f"\n--- 句 {s['sort_order']} (id {s['id']}) sim={s['sim']} cov={s.get('coverage')}")
    print('  库中文本:', s['en'])
    print('  音频转写:', s['asr_text'])

json.dump(segs, open('/tmp/u1_aligned.json', 'w'), ensure_ascii=False, indent=1)
print('\nsaved /tmp/u1_aligned.json')
