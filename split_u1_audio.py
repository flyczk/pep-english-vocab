#!/usr/bin/env python3
"""按句切分官方课文音频。
算法：词数比例给出预期边界 → 在 ±窗口内吸附到最近的静音段中点。
自检：每段时长合理性 + 段时长与句长的相关性。
"""
import subprocess, re, json, sys

AUDIO = sys.argv[1] if len(sys.argv) > 1 else '/tmp/u1_sectionB_1b.mp3'

# (sort_order, id, en, words)
SENTENCES = [
    (19, 139, "Today was our first day to visit Moscow.", 8),
    (20, 140, "The weather was fine and everyone felt excited to visit some famous places in Russia.", 14),
    (21, 141, "In the morning, we went to the Victory Museum.", 9),
    (22, 142, "The Russian people built this museum to remember their fight against the Nazis during World War II.", 16),
    (23, 143, "As we walked through the halls, the tour guide told us stories about the war.", 15),
    (24, 144, 'In one hall, I saw an artwork with thousands of glass "tears" falling down.', 13),
    (25, 145, "It reminds us that war is terrible and peace does not come easily.", 12),
    (26, 146, "We should not forget that.", 5),
    (27, 147, "At noon, we had lunch at a restaurant near the park.", 11),
    (28, 148, "I liked the ice cream there, so I ate a lot of it.", 12),
    (29, 149, "But, during dinner, I didn't feel like eating because I felt sick.", 12),
    (30, 150, "So now, I just want to get a good night's sleep.", 11),
    (31, 151, "It rained last night, so this morning the air was fresh and cool.", 13),
    (32, 152, "I felt much better today.", 5),
    (33, 153, "We took the Moscow Metro to travel around.", 8),
    (34, 154, "The metro stations are really beautiful.", 6),
    (35, 155, "Sometimes I felt like I was walking inside a palace.", 10),
    (36, 156, "After that, we went to Red Square.", 7),
    (37, 157, "It was fantastic!", 3),
    (38, 158, "In the afternoon, we arrived at a school and met a group of Russian students.", 14),
    (39, 159, "We played games and soon became friends.", 7),
    (40, 160, "Later, someone took out his accordion, and soon everyone got together to sing and dance.", 15),
    (41, 161, "We were so happy that we didn't notice the time.", 10),
    (42, 162, "It was such a good experience!", 6),
]

def get_duration(p):
    out = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p],
                         capture_output=True, text=True).stdout.strip()
    return float(out)

def get_silences(p):
    r = subprocess.run(['ffmpeg','-hide_banner','-i',p,'-af','silencedetect=noise=-35dB:d=0.30','-f','null','-'],
                       capture_output=True, text=True)
    txt = r.stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', txt)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', txt)]
    return list(zip(starts, ends))

dur = get_duration(AUDIO)
sils = get_silences(AUDIO)
mids = [(s + e) / 2 for s, e in sils if (e - s) >= 0.28]
print(f'duration={dur:.2f}s  silence_segments={len(sils)}  candidate_mids={len(mids)}')

n = len(SENTENCES)
total_words = sum(w for *_ , w in SENTENCES)
# 有效区间：去掉首尾静音
lead = sils[0][1] if sils and sils[0][0] < 0.5 else 0.0
tail = sils[-1][0] if sils and (dur - sils[-1][1]) < 0.5 else dur
span = tail - lead
print(f'lead={lead:.2f} tail={tail:.2f} span={span:.2f}')

# 预期边界（按词数比例）
cum = 0
expected = []
for i, (so, sid, en, w) in enumerate(SENTENCES[:-1]):
    cum += w
    expected.append(lead + span * cum / total_words)

# 吸附：在 ±1.6s 内找最近的静音段，记录其 (start, end)
WINDOW = 1.6
bounds = []   # (sil_start, sil_end)
used = set()
for exp in expected:
    best, bd = None, None
    for j, (s, e) in enumerate(sils):
        if (e - s) < 0.28 or j in used:
            continue
        m = (s + e) / 2
        d = abs(m - exp)
        if d <= WINDOW and (best is None or d < bd):
            best, bd = j, d
    if best is not None:
        used.add(best)
        bounds.append(sils[best])
    else:
        bounds.append((exp, exp))

# 保证单调递增
for i in range(1, len(bounds)):
    if bounds[i][0] <= bounds[i-1][0]:
        bounds[i] = (bounds[i-1][0] + 0.05, bounds[i-1][1] + 0.05)

# 每段 = 纯语音：start 取上一个静音的 end，end 取当前静音的 start
segs = []
prev_end = lead
for i, (so, sid, en, w) in enumerate(SENTENCES):
    if i < len(bounds):
        end = bounds[i][0]
        nxt = bounds[i][1]
    else:
        end, nxt = tail, tail
    segs.append({'sort_order': so, 'id': sid, 'en': en, 'words': w,
                 'start': round(prev_end, 3), 'end': round(end, 3)})
    prev_end = nxt

# 自检
print('\n=== 切分结果 ===')
bad = []
for s in segs:
    d = s['end'] - s['start']
    flag = ''
    if d < 0.8: flag = ' <-- 过短'; bad.append(s)
    if d > 14: flag = ' <-- 过长'; bad.append(s)
    print(f"{s['sort_order']:>3} id={s['id']} {s['start']:>7.2f}-{s['end']:>7.2f} ({d:>5.2f}s, {s['words']:>2}w) {s['en'][:52]}{flag}")

# 相关性：时长 vs 词数
import statistics
ds = [s['end']-s['start'] for s in segs]
ws = [s['words'] for s in segs]
if len(ds) > 2:
    md, mw = statistics.mean(ds), statistics.mean(ws)
    n = len(ds)
    cov = sum((a-md)*(b-mw) for a, b in zip(ds, ws)) / n
    sd = statistics.pstdev(ds); sw = statistics.pstdev(ws)
    r = cov/(sd*sw) if sd and sw else 0
    print(f'\n时长-词数 相关系数 r = {r:.3f}  (>=0.80 视为切分合理)')

print(f'异常段: {len(bad)} 个')
if bad:
    print('需人工复核的段：', [b['id'] for b in bad])

with open('/tmp/u1_segments.json','w') as f:
    json.dump(segs, f, ensure_ascii=False, indent=1)
print('\nsaved /tmp/u1_segments.json')
