#!/usr/bin/env python3
"""多音频对齐：对每个句子在多个官方音频里找最佳匹配（相似度最高），切分并逐段回验。"""
import json, os, re, subprocess, difflib

MODEL = os.path.expanduser('~/whisper-models/ggml-base.en.bin')
SRCDIR = '/tmp/u1_secA'
OUTDIR = '/tmp/u1_secA/clips_v2'
PAD_HEAD, PAD_TAIL = 0.12, 0.18

AUDIOS = ['u1_a_1b', 'u1_a_1c', 'u1_a_2a', 'u1_a_2d']

# U1 Section A 18 句（lesson 82, sort_order 1-18, id 1-18+）实际 id 从库里查；先按 sort_order
SENTENCES = [
 (1,  "Where did you go on holiday?"),
 (2,  "I didn't go anywhere special, but I tried something new — I worked as a tour guide at a museum."),
 (3,  "Did you do anything interesting on your holiday?"),
 (4,  "No, nothing special. But I met someone interesting."),
 (5,  "Did you go anywhere interesting?"),
 (6,  "Yes, I went to Yunnan."),
 (7,  "Did you go with anyone?"),
 (8,  "Yes, I went with my family."),
 (9,  "Did you eat anything special?"),
 (10, "Yes, we did! Everything tasted good, especially the steamed chicken soup. Everyone loved it."),
 (11, "How was your holiday?"),
 (12, "It was fantastic."),
 (13, "Yes, we stayed in the old town for a few days, and we enjoyed it very much."),
 (14, "Did you visit Yulong Mountain?"),
 (15, "It is! It just took my breath away."),
 (16, "What about you?"),
 (17, "I just stayed at home to read, play games, and relax, but it was still fun."),
 (18, "How was your summer holiday?"),
]

def words_of(t):
    return [w for w in re.findall(r"[a-z0-9']+", t.lower().replace('’', "'")) if w]

# 载入 4 个音频的词序列
audio_words = {}
for a in AUDIOS:
    d = json.load(open(f'{SRCDIR}/{a}_asr.json'))
    ws = []
    for s in d['transcription']:
        if not words_of(s.get('text', '')):
            continue
        off = s.get('offsets', {})
        for w in words_of(s.get('text', '')):
            ws.append({'w': w, 'start': off.get('from', 0) / 1000, 'end': off.get('to', 0) / 1000})
    audio_words[a] = ws
    print(f'{a}: {len(ws)} words, {ws[-1]["end"]:.1f}s')

os.makedirs(OUTDIR, exist_ok=True)
results = []
for (so, en) in SENTENCES:
    best = None
    for a in AUDIOS:
        aw = audio_words[a]
        sm = difflib.SequenceMatcher(a=[x['w'] for x in aw], b=words_of(en), autojunk=False)
        mapping = {}
        for a0, b0, size in sm.get_matching_blocks():
            for k in range(size):
                mapping[b0 + k] = a0 + k
        rw = words_of(en)
        hit = [mapping[i] for i in range(len(rw)) if i in mapping]
        cov = len(hit) / len(rw) if rw else 0
        if len(hit) >= 2:
            af, al = min(hit), max(hit)
            st, et = aw[af]['start'], aw[al]['end']
            asr_text = ' '.join(x['w'] for x in aw[af:al + 1])
            sim = difflib.SequenceMatcher(a=rw, b=asr_text.split(), autojunk=False).ratio()
            if best is None or sim > best['sim']:
                best = {'audio': a, 'start': st, 'end': et, 'sim': round(sim, 3),
                        'cov': round(cov, 3), 'asr_text': asr_text}
    results.append({'sort_order': so, 'en': en, **(best or {'audio': None, 'sim': 0, 'cov': 0, 'asr_text': ''})})

print('\n=== 最佳归属 ===')
print(f'{"序":>3} {"音频":>10} {"起-止":>16} {"相似":>6}  句子')
for r in results:
    if r['audio']:
        print(f"{r['sort_order']:>3} {r['audio']:>10} {r['start']:>7.2f}-{r['end']:>7.2f} {r['sim']:>6.2f}  {r['en'][:48]}")
    else:
        print(f"{r['sort_order']:>3} {'—':>10} {'无匹配':>16}        {r['en'][:48]}")

# 排除重叠：同一音频内句子区间排序后消除交叉
by_audio = {}
for r in results:
    if r['audio']:
        by_audio.setdefault(r['audio'], []).append(r)
for a, rs in by_audio.items():
    rs.sort(key=lambda x: x['start'])
    for i in range(1, len(rs)):
        if rs[i]['start'] < rs[i-1]['end']:
            mid = (rs[i]['start'] + rs[i-1]['end']) / 2
            rs[i-1]['end'] = mid - 0.02
            rs[i]['start'] = mid + 0.02

# 切分 + 回验
print('\n=== 切分 + 逐段回验 ===')
final = []
for r in results:
    if not r['audio']:
        final.append({**r, 'clip': None, 'skip': 'no_match'})
        continue
    st, et = max(0, r['start'] - PAD_HEAD), r['end'] + PAD_TAIL
    name = f"u1a_{r['sort_order']}_v2"
    clip = os.path.join(OUTDIR, name + '.mp3')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(st), '-to', str(et),
                    '-i', f'{SRCDIR}/{r["audio"]}.mp3', '-c', 'copy', clip], capture_output=True)
    if not (os.path.exists(clip) and os.path.getsize(clip) > 800):
        final.append({**r, 'clip': None, 'skip': 'ffmpeg_fail'})
        continue
    wav = clip.replace('.mp3', '.wav')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', clip, '-ar', '16000', '-ac', '1', wav], capture_output=True)
    prefix = clip.replace('.mp3', '_asr')
    subprocess.run(['whisper-cli', '-m', MODEL, '-f', wav, '-l', 'en', '-nt', '-oj', '-of', prefix],
                   capture_output=True, text=True)
    try:
        d = json.load(open(prefix + '.json'))
        txt = ''.join(x.get('text', '') for x in d['transcription']).strip()
    except Exception:
        txt = ''
    sim2 = difflib.SequenceMatcher(a=words_of(r['en']), b=words_of(txt), autojunk=False).ratio()
    verdict = 'OK' if sim2 >= 0.85 else '!!'
    print(f"{r['sort_order']:>3} {et-st:>5.2f}s {sim2:>6.2f} {verdict}  {txt[:56]}")
    final.append({**r, 'clip': clip, 'recheck_sim': round(sim2, 3), 'recheck_text': txt,
                  'c_start': round(st, 3), 'c_end': round(et, 3)})

json.dump(final, open(os.path.join(OUTDIR, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
n_ok = sum(1 for r in final if r.get('recheck_sim', 0) >= 0.85)
print(f'\n通过回验 {n_ok}/{len(SENTENCES)}')
