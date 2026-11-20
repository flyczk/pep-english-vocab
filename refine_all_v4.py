#!/usr/bin/env python3
"""全量修复：对 U1 全部音频段重切并自动修剪静音头尾（迭代收敛），统一升版本 _v4。"""
import json, os, re, subprocess, difflib

MODEL = os.path.expanduser('~/whisper-models/ggml-base.en.bin')
OUTDIR = '/tmp/u1_v4'
SRC_B = '/Users/jeffchen/WorkBuddy/2026-10-19-02-58-58/audio_assets/u1_sectionB_1b.mp3'
SRCDIR = '/tmp/u1_secA'
os.makedirs(OUTDIR, exist_ok=True)

def words_of(t):
    return [w for w in re.findall(r"[a-z0-9']+", t.lower().replace('’', "'")) if w]

def dur_of(p):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                 '-of', 'csv=p=0', p], capture_output=True, text=True).stdout.strip() or 0)

def head_tail(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af',
                        'silencedetect=noise=-35dB:d=0.10', '-f', 'null', '-'],
                       capture_output=True, text=True)
    txt = r.stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', txt)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', txt)]
    pairs = list(zip(starts, ends))
    dur = dur_of(path)
    head = pairs[0][1] if pairs and pairs[0][0] <= 0.05 else 0.0
    tail = dur - pairs[-1][0] if pairs and pairs[-1][1] >= dur - 0.05 else 0.0
    return head, tail

def cut(src, st, et, out):
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{st:.3f}', '-to', f'{et:.3f}',
                    '-i', src, '-c', 'copy', out], capture_output=True)
    return os.path.exists(out) and os.path.getsize(out) > 800

def refine(src, st, et, out, keep_head=0.05, keep_tail=0.12):
    """切分后自动修剪静音头尾（最多 2 轮迭代）"""
    if not cut(src, st, et, out):
        return None
    for _ in range(2):
        head, tail = head_tail(out)
        if head <= 0.30 and tail <= 0.45:
            break
        st2, et2 = st, et
        if head > 0.30:
            st2 = st + (head - keep_head)
        if tail > 0.45:
            et2 = et - (tail - keep_tail)
        if et2 - st2 < 0.6:
            break
        st, et = st2, et2
        if not cut(src, st, et, out):
            return None
    return {'start': round(st, 3), 'end': round(et, 3), 'dur': round(et - st, 3),
            'head': round(head_tail(out)[0], 2), 'tail': round(head_tail(out)[1], 2)}

# ============ Section B（24 句，源=u1_sectionB_1b.mp3） ============
metaB = json.load(open('/tmp/u1_clips_v2/meta.json'))
results = []
print('=== Section B ===')
for m in metaB:
    so = m['sort_order']
    if m.get('skip'):  # 句37无音频
        results.append({'so': so, 'clip': None, 'skip': 'no_official_audio'})
        print(f'{so:>3} 无官方音频（维持TTS）')
        continue
    out = os.path.join(OUTDIR, f'u1_b1b_{so}_v4.mp3')
    info = refine(SRC_B, m['c_start'], m['c_end'], out)
    if info:
        results.append({'so': so, 'clip': out, **info})
        print(f"{so:>3} {info['dur']:>5.2f}s head={info['head']} tail={info['tail']}")
    else:
        results.append({'so': so, 'clip': None, 'skip': 'cut_fail'})
        print(f'{so:>3} 切分失败')

# ============ Section A（15 段，源=各板块音频） ============
metaA = json.load(open('/tmp/u1_secA/final_v2/meta.json'))
print('\n=== Section A ===')
for m in metaA:
    so = m['sort_order']
    if m.get('skip'):
        results.append({'so': so, 'clip': None, 'skip': 'no_official_audio'})
        print(f'{so:>3} 无官方音频（维持TTS）')
        continue
    src = os.path.join(SRCDIR, m['audio'] + '.mp3')
    out = os.path.join(OUTDIR, f'u1a_{so}_v4.mp3')
    info = refine(src, m['c_start'], m['c_end'], out)
    if info:
        results.append({'so': so, 'clip': out, **info})
        print(f"{so:>3} {info['dur']:>5.2f}s head={info['head']} tail={info['tail']}")
    else:
        results.append({'so': so, 'clip': None, 'skip': 'cut_fail'})
        print(f'{so:>3} 切分失败')

json.dump(results, open(os.path.join(OUTDIR, 'meta_v4.json'), 'w'), ensure_ascii=False, indent=1)
n_ok = sum(1 for r in results if r.get('clip'))
n_bad = sum(1 for r in results if r.get('clip') and (r.get('head', 0) > 0.30 or r.get('tail', 0) > 0.45))
print(f'\n完成 {n_ok} 段，其中仍超阈值 {n_bad} 段')
