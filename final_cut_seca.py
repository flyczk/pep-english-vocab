#!/usr/bin/env python3
"""U1 Section A 最终切分：人工逐句定位的锚点词序列 → 精确时间 → 切分 → ASR 回验。"""
import json, os, re, subprocess, difflib

MODEL = os.path.expanduser('~/whisper-models/ggml-base.en.bin')
SRCDIR = '/tmp/u1_secA'
OUTDIR = '/tmp/u1_secA/final_v2'
PAD_HEAD, PAD_TAIL = 0.15, 0.22

def words_of(t):
    return [w for w in re.findall(r"[a-z0-9']+", t.lower().replace('’', "'")) if w]

# 载入音频词序列
AW = {}
for a in ['u1_a_1b', 'u1_a_1c', 'u1_a_2a', 'u1_a_2d']:
    d = json.load(open(f'{SRCDIR}/{a}_asr.json'))
    ws = []
    for s in d['transcription']:
        ws_words = words_of(s.get('text', ''))
        if not ws_words:
            continue
        off = s.get('offsets', {})
        # 一个 ASR 段可能含多词，时间用段的起止；粒度足够（段已按 -ml 1 切分）
        for w in ws_words:
            ws.append({'w': w, 'start': off.get('from', 0) / 1000, 'end': off.get('to', 0) / 1000})
    AW[a] = ws

def find_span(audio, anchor):
    """在音频词序列中找锚点子序列，返回 (首词start, 末词end) 或 None"""
    aw = [x['w'] for x in AW[audio]]
    n, m = len(aw), len(anchor)
    for i in range(n - m + 1):
        if aw[i:i + m] == anchor:
            return AW[audio][i]['start'], AW[audio][i + m - 1]['end']
    return None

# (sort_order, 句子, 音频, 锚点)  锚点=ASR词形（含 ASR 错拼），None=无音频
PLAN = [
 (1,  "Where did you go on holiday?", 'u1_a_1c', ['where','did','you','go','on','holiday']),
 (2,  "I didn't go anywhere special, but I tried something new — I worked as a tour guide at a museum.", None, None),
 (3,  "Did you do anything interesting on your holiday?", 'u1_a_1c', ['so','did','you','do','anything','interesting','there']),
 (4,  "No, nothing special. But I met someone interesting.", None, None),
 (5,  "Did you go anywhere interesting?", 'u1_a_2d', ['did','you','go','anywhere','interesting']),
 (6,  "Yes, I went to Yunnan.", 'u1_a_2d', ['yes','i','went','to','you','non','with','my','family']),
 (7,  "Did you go with anyone?", 'u1_a_1c', ['did','you','go','with','anyone']),
 (8,  "Yes, I went with my family.", 'u1_a_1c', ['yeah','i','went','with','my','family']),
 (9,  "Did you eat anything special?", 'u1_a_2d', ['did','you','eat','anything','special']),
 (10, "Yes, we did! Everything tasted good, especially the steamed chicken soup. Everyone loved it.", 'u1_a_2d',
      ['yes','we','did','everything','tasted','good','especially','the','ste','amed','chicken','soup']),
 (11, "How was your holiday?", 'u1_a_2d', ['how','was','your','holiday']),
 (12, "It was fantastic.", 'u1_a_2d', ['it','was','fantastic']),
 (13, "Yes, we stayed in the old town for a few days, and we enjoyed it very much.", 'u1_a_2d',
      ['yes','we','stayed','in','the','old','town','for','a','few','days','and','we','enjoyed','it','very','much']),
 (14, "Did you visit Yulong Mountain?", 'u1_a_2d', ['did','you','visit','y','ul','ong','mountain']),
 (15, "It is! It just took my breath away.", 'u1_a_2d', ['it','is','it','just','took','my','breath','away']),
 (16, "What about you?", 'u1_a_2d', ['what','about','you']),
 (17, "I just stayed at home to read, play games, and relax, but it was still fun.", 'u1_a_2d',
      ['i','just','stayed','at','home','to','read','play','games','and','relax','but','it','was','still','fun']),
 (18, "How was your summer holiday?", None, None),
]

os.makedirs(OUTDIR, exist_ok=True)
final = []
print('=== 定位与切分 ===')
for (so, en, audio, anchor) in PLAN:
    item = {'sort_order': so, 'en': en, 'audio': audio}
    if audio is None:
        item['skip'] = 'no_official_audio'
        final.append(item)
        print(f"{so:>3} 无官方音频 → TTS")
        continue
    span = find_span(audio, anchor)
    if not span:
        item['skip'] = 'anchor_not_found'
        final.append(item)
        print(f"{so:>3} 锚点未找到!")
        continue
    st, et = span
    st, et = max(0, st - PAD_HEAD), et + PAD_TAIL
    name = f"u1a_{so}_v2.mp3"
    clip = os.path.join(OUTDIR, name)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(st), '-to', str(et),
                    '-i', f'{SRCDIR}/{audio}.mp3', '-c', 'copy', clip], capture_output=True)
    size = os.path.getsize(clip) if os.path.exists(clip) else 0
    item.update({'clip': clip, 'c_start': round(st, 3), 'c_end': round(et, 3), 'size': size})
    print(f"{so:>3} {audio:>10} {st:>6.2f}-{et:>6.2f}  {size//1024}KB")
    final.append(item)

# 逐段回验
print('\n=== ASR 回验 ===')
for it in final:
    if not it.get('clip'):
        continue
    wav = it['clip'].replace('.mp3', '.wav')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', it['clip'], '-ar', '16000', '-ac', '1', wav], capture_output=True)
    prefix = it['clip'].replace('.mp3', '_asr')
    subprocess.run(['whisper-cli', '-m', MODEL, '-f', wav, '-l', 'en', '-nt', '-oj', '-of', prefix], capture_output=True, text=True)
    try:
        d = json.load(open(prefix + '.json'))
        txt = ''.join(x.get('text', '') for x in d['transcription']).strip()
    except Exception:
        txt = ''
    sim = difflib.SequenceMatcher(a=words_of(it['en']), b=words_of(txt), autojunk=False).ratio()
    it['recheck_sim'] = round(sim, 3)
    it['recheck_text'] = txt
    print(f"{it['sort_order']:>3} sim={sim:>5.2f}  {txt[:70]}")

json.dump(final, open(os.path.join(OUTDIR, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
ok = sum(1 for x in final if x.get('recheck_sim', 0) >= 0.85)
print(f'\n切出 {sum(1 for x in final if x.get("clip"))} 段，回验通过 {ok} 段')
