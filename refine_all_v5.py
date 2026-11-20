#!/usr/bin/env python3
"""v5：用「真静音阈值(-50dB) + ASR 首末词位置」精确确定句界，杜绝带入上一句尾音。
思路：
  - 上一句尾音与本句之间的静音，才是真正的句界
  - 在 ASR 首词时间戳 ±0.9s 内找最近的静音段，取其 end 作为起点
  - 在 ASR 末词时间戳 ±0.9s 内找最近的静音段，取其 start 作为终点
"""
import json, os, re, subprocess, array, math

MODEL = os.path.expanduser('~/whisper-models/ggml-base.en.bin')
OUTDIR = '/tmp/u1_v5'
SRC_B = '/Users/jeffchen/WorkBuddy/2026-10-19-02-58-58/audio_assets/u1_sectionB_1b.mp3'
SRCDIR = '/tmp/u1_secA'
os.makedirs(OUTDIR, exist_ok=True)

SIL_DB = -50.0      # 真静音阈值
SIL_MIN = 0.22      # 最小静音时长
WIN = 0.02

def words_of(t):
    return [w for w in re.findall(r"[a-z0-9']+", t.lower().replace('’', "'")) if w]

def rms_profile(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'],
                         capture_output=True).stdout
    a = array.array('h'); a.frombytes(raw)
    n = int(16000 * WIN)
    out = []
    for i in range(0, len(a) - n, n):
        seg = a[i:i + n]
        r = math.sqrt(sum(x * x for x in seg) / n)
        out.append(20 * math.log10(r / 32768) if r > 0 else -99)
    return out  # 每 20ms 一个 dB

def silence_spans(prof):
    spans, cur = [], None
    for i, db in enumerate(prof):
        t = i * WIN
        if db < SIL_DB:
            if cur is None:
                cur = t
        else:
            if cur is not None and t - cur >= SIL_MIN:
                spans.append((round(cur, 3), round(t, 3)))
            cur = None
    if cur is not None and len(prof) * WIN - cur >= SIL_MIN:
        spans.append((round(cur, 3), round(len(prof) * WIN, 3)))
    return spans

def best_boundary(spans, target, prefer='end'):
    """找离 target 最近的静音段，返回 (start,end)"""
    if not spans:
        return None
    best = min(spans, key=lambda s: min(abs(s[0] - target), abs(s[1] - target)))
    d = min(abs(best[0] - target), abs(best[1] - target))
    return best if d <= 0.95 else None

def cut(src, st, et, out):
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{st:.3f}', '-to', f'{et:.3f}',
                    '-i', src, '-c', 'copy', out], capture_output=True)
    return os.path.exists(out) and os.path.getsize(out) > 800

def asr_text(path):
    wav = path.replace('.mp3', '_chk.wav')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', path, '-ar', '16000', '-ac', '1', wav], capture_output=True)
    pre = path.replace('.mp3', '_chk')
    subprocess.run(['whisper-cli', '-m', MODEL, '-f', wav, '-l', 'en', '-nt', '-oj', '-of', pre],
                   capture_output=True, text=True)
    try:
        d = json.load(open(pre + '.json'))
        return ''.join(x.get('text', '') for x in d['transcription']).strip()
    except Exception:
        return ''

results = []
def process(src, so, w_start, w_end, name, ref_en, pad_before=0.03, pad_after=0.10):
    """w_start/w_end = ASR 首词 start / 末词 end（相对源音频）"""
    # 分析窗口：放宽到首词前 1.2s、末词后 1.2s
    a0 = max(0.0, w_start - 1.2)
    a1 = w_end + 1.2
    tmp = os.path.join(OUTDIR, f'_tmp_{name}.wav')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{a0:.3f}', '-to', f'{a1:.3f}',
                    '-i', src, '-ar', '16000', '-ac', '1', tmp], capture_output=True)
    prof = rms_profile(tmp)
    spans = [(round(a0 + s, 3), round(a0 + e, 3)) for s, e in silence_spans(prof)]

    sb = best_boundary(spans, w_start)
    eb = best_boundary(spans, w_end)
    st = (sb[1] + pad_before) if sb else max(0.0, w_start - pad_before)
    et = (eb[0] + pad_after) if eb else (w_end + 0.15)
    if et - st < 0.5:
        st, et = max(0.0, w_start - pad_before), w_end + 0.15

    out = os.path.join(OUTDIR, name)
    if not cut(src, st, et, out):
        return {'so': so, 'clip': None, 'skip': 'cut_fail'}
    txt = asr_text(out)
    import difflib
    sim = difflib.SequenceMatcher(a=words_of(ref_en), b=words_of(txt), autojunk=False).ratio()
    # 二次确认边界
    prof2 = rms_profile(out.replace('.mp3', '_chk.wav')) if os.path.exists(out.replace('.mp3', '_chk.wav')) else []
    head = tail = 0.0
    if prof2:
        sp2 = silence_spans(prof2)
        if sp2 and sp2[0][0] <= 0.05:
            head = sp2[0][1]
        if sp2 and sp2[-1][1] >= len(prof2) * WIN - 0.05:
            tail = len(prof2) * WIN - sp2[-1][0]
    return {'so': so, 'clip': out, 'start': round(st, 3), 'end': round(et, 3),
            'dur': round(et - st, 2), 'sim': round(sim, 2), 'asr': txt, 'head': round(head, 2), 'tail': round(tail, 2)}

# ---------- Section B ----------
alignB = json.load(open('/Users/jeffchen/WorkBuddy/2026-10-19-02-58-58/audio_assets/u1_aligned.json'))
print('=== Section B (v5) ===')
for m in alignB:
    so = m['sort_order']
    if m.get('start') is None:
        results.append({'so': so, 'clip': None, 'skip': 'no_official_audio'})
        print(f'{so:>3} 无官方音频')
        continue
    r = process(SRC_B, so, m['start'], m['end'], f'u1_b1b_{so}_v5.mp3', m['en'])
    results.append(r)
    if r.get('clip'):
        print(f"{so:>3} {r['start']:6.2f}-{r['end']:6.2f} ({r['dur']:>5.2f}s) sim={r['sim']} head={r['head']} tail={r['tail']}")
    else:
        print(f"{so:>3} 失败")

# ---------- Section A ----------
metaA = json.load(open('/tmp/u1_secA/final_v2/meta.json'))
print('\n=== Section A (v5) ===')
SENT_A = {
 1:"Where did you go on holiday?",
 3:"So, did you do anything interesting there?",
 5:"Did you go anywhere interesting?",
 6:"Yes, I went to Yunnan with my family.",
 7:"Did you go with anyone?",
 8:"Yes, I went with my family.",
 9:"Did you eat anything special?",
 10:"Yes, we did! Everything tasted good, especially the steamed chicken soup.",
 11:"How was your holiday?",
 12:"It was fantastic.",
 13:"Yes, we stayed in the old town for a few days, and we enjoyed it very much.",
 14:"Did you visit Yulong Mountain?",
 15:"It is! It just took my breath away.",
 16:"What about you?",
 17:"I just stayed at home to read, play games, and relax, but it was still fun.",
}
for m in metaA:
    so = m['sort_order']
    if m.get('skip'):
        results.append({'so': so, 'clip': None, 'skip': 'no_official_audio'})
        print(f'{so:>3} 无官方音频')
        continue
    src = os.path.join(SRCDIR, m['audio'] + '.mp3')
    # 由 c_start/c_end 反推 ASR 首词/末词（c_start 曾 = w_start-0.15, c_end = w_end+0.22）
    w_start, w_end = m['c_start'] + 0.15, m['c_end'] - 0.22
    ref = SENT_A.get(so, '')
    r = process(src, so, w_start, w_end, f'u1a_{so}_v5.mp3', ref)
    results.append(r)
    if r.get('clip'):
        print(f"{so:>3} {r['start']:6.2f}-{r['end']:6.2f} ({r['dur']:>5.2f}s) sim={r['sim']} head={r['head']} tail={r['tail']}")
    else:
        print(f"{so:>3} 失败")

json.dump(results, open(os.path.join(OUTDIR, 'meta_v5.json'), 'w'), ensure_ascii=False, indent=1)
ok = [r for r in results if r.get('clip')]
badh = [r for r in ok if r.get('head', 0) > 0.25 or r.get('tail', 0) > 0.40]
bads = [r for r in ok if r.get('sim', 1) < 0.80]
print(f'\n切出 {len(ok)} 段 | 边界超标 {len(badh)} | 相似度<0.80 {len(bads)}')
if badh: print('边界问题:', [(r['so'], r['head'], r['tail']) for r in badh])
if bads: print('相似度问题:', [(r['so'], r['sim']) for r in bads])
