#!/usr/bin/env python3
"""按 ASR 对齐结果切分，并对每一段重新做 ASR 回验（真正的内容校验）。"""
import json, subprocess, os, re, difflib

ALIGNED = '/tmp/u1_aligned.json'
SRC = '/tmp/u1_sectionB_1b.mp3'
OUTDIR = '/tmp/u1_clips_v2'
MODEL = os.path.expanduser('~/whisper-models/ggml-base.en.bin')
PAD_HEAD, PAD_TAIL = 0.12, 0.18

def words_of(t):
    return [w for w in re.findall(r"[a-z0-9']+", t.lower().replace('’', "'")) if w]

segs = json.load(open(ALIGNED))
os.makedirs(OUTDIR, exist_ok=True)

# 切分
cut = []
for s in segs:
    if s['start'] is None:
        cut.append({**s, 'clip': None, 'skip': 'no_asr_match'})
        continue
    cut.append({**s, 'clip': None, 'skip': None})

# 边界修正：不重叠、顺序单调
for i, s in enumerate(cut):
    if s['start'] is None:
        continue
    st = max(0.0, s['start'] - PAD_HEAD)
    en = min(132.9, s['end'] + PAD_TAIL)
    if i > 0 and cut[i-1].get('end') is not None:
        st = max(st, cut[i-1]['end'] + PAD_TAIL - 0.05)
    s['c_start'], s['c_end'] = round(st, 3), round(en, 3)

ok = 0
for s in cut:
    if s['start'] is None:
        continue
    f = os.path.join(OUTDIR, f"u1_b1b_{s['sort_order']}.mp3")
    r = subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(s['c_start']), '-to', str(s['c_end']),
                        '-i', SRC, '-c', 'copy', f], capture_output=True, text=True)
    if r.returncode == 0 and os.path.getsize(f) > 800:
        s['clip'] = f
        ok += 1
    else:
        s['skip'] = 'ffmpeg_fail'
print(f'切出 {ok} 段')

# 逐段回验：转 wav → whisper → 与句子文本比对
print('\n=== 逐段 ASR 回验 ===')
print(f'{"序":>3} {"时长":>6} {"相似度":>7} {"判定":>6}  音频转写')
problems = []
for s in cut:
    if not s['clip']:
        print(f"{s['sort_order']:>3}  ——      ——   跳过   ({s['skip']})")
        problems.append(s)
        continue
    wav = s['clip'].replace('.mp3', '.wav')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', s['clip'], '-ar', '16000', '-ac', '1', wav],
                   capture_output=True)
    prefix = s['clip'].replace('.mp3', '_asr')
    subprocess.run(['whisper-cli', '-m', MODEL, '-f', wav, '-l', 'en', '-nt', '-oj', '-of', prefix],
                   capture_output=True, text=True)
    try:
        d = json.load(open(prefix + '.json'))
        txt = ''.join(x.get('text', '') for x in d['transcription'])
    except Exception:
        txt = ''
    sim = difflib.SequenceMatcher(a=words_of(s['en']), b=words_of(txt), autojunk=False).ratio()
    verdict = 'OK' if sim >= 0.85 else '!!'
    if sim < 0.85:
        problems.append({**s, 'recheck_sim': round(sim, 3), 'recheck_text': txt.strip()})
    dur = s['c_end'] - s['c_start']
    print(f"{s['sort_order']:>3} {dur:>6.2f} {sim:>7.2f} {verdict:>6}  {txt.strip()[:60]}")
    s['recheck_sim'] = round(sim, 3)
    s['recheck_text'] = txt.strip()

json.dump(cut, open('/tmp/u1_clips_v2/meta.json', 'w'), ensure_ascii=False, indent=1)

print(f'\n=== 回验未通过 / 跳过：{len(problems)} 段 ===')
for p in problems:
    print(f"\n句 {p['sort_order']} (id {p['id']})  原因: {p.get('skip') or 'sim<0.85'}")
    print('  库中文本:', p['en'])
    print('  音频转写:', (p.get('recheck_text') or p.get('asr_text') or '')[:200])
