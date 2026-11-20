#!/usr/bin/env python3
"""全量校验：对线上每个音频段测量首尾静音长度，找出"头/尾静音过长"的段。
原理：whisper 词时间戳有系统性偏移风险，切出的段可能带静音头/尾。
修正：头静音 > 0.30s 或尾静音 > 0.45s 的段，在源音频上按偏移重切。
"""
import json, subprocess, os

SRCDIR = '/tmp/u1_secA'
MODEL = os.path.expanduser('~/whisper-models/ggml-base.en.bin')

def silences(path, thr=-35, d=0.10):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af',
                        f'silencedetect=noise={thr}dB:d={d}', '-f', 'null', '-'],
                       capture_output=True, text=True)
    txt = r.stderr
    starts = [float(x) for x in __import__('re').findall(r'silence_start: ([\d.]+)', txt)]
    ends = [float(x) for x in __import__('re').findall(r'silence_end: ([\d.]+)', txt)]
    pairs = list(zip(starts, ends))
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip())
    head = pairs[0][1] if pairs and pairs[0][0] <= 0.05 else 0.0
    tail = dur - pairs[-1][0] if pairs and pairs[-1][1] >= dur - 0.05 else 0.0
    return dur, head, tail, pairs

meta = json.load(open('/tmp/u1_secA/final_v2/meta.json'))
metab = json.load(open('/Users/jeffchen/WorkBuddy/2026-10-19-02-58-58/audio_assets/u1_seca_meta.json')) if os.path.exists('/Users/jeffchen/WorkBuddy/2026-10-19-02-58-58/audio_assets/u1_seca_meta.json') else []
os.makedirs('/tmp/audit', exist_ok=True)

problems = []
print(f'{"句":>3} {"时长":>6} {"头静":>6} {"尾静":>6}  判定')
# Section A（源 = 各板块音频，需用 c_start/c_end 换算回源）
for it in metab:
    if not it.get('clip'):
        continue
    so = it['sort_order']
    local = f'/tmp/audit/u1a_{so}.mp3'
    if not os.path.exists(local):
        subprocess.run(['curl', '-s', '--max-time', '30', '-o', local,
                        f'https://words.vip.cpolar.cn/audio/u1a_{so}_v2.mp3'], capture_output=True)
    if not os.path.exists(local) or os.path.getsize(local) < 1000:
        print(f'{so:>3} 下载失败'); continue
    dur, head, tail, pairs = silences(local)
    bad = head > 0.30 or tail > 0.45
    print(f'{so:>3} {dur:>6.2f} {head:>6.2f} {tail:>6.2f}  {"<<< 需修" if bad else "OK"}')
    if bad:
        problems.append({'sec': 'A', 'so': so, 'dur': dur, 'head': head, 'tail': tail,
                         'src': it['audio'], 'src_start': it['c_start'], 'src_end': it['c_end'],
                         'head_pairs': pairs[:2], 'tail_pairs': pairs[-2:]})

# Section B（源 /tmp/u1_sectionB_1b.mp3，audio_assets 有备份）
SRCB = '/Users/jeffchen/WorkBuddy/2026-10-19-02-58-58/audio_assets/u1_sectionB_1b.mp3'
import json as J
metabB = J.load(open('/Users/jeffchen/WorkBuddy/2026-10-19-02-58-58/audio_assets/u1_seca_meta.json'))  # 占位防错
for so in range(19, 43):
    if so == 37:
        continue
    local = f'/tmp/audit/u1b_{so}.mp3'
    if not os.path.exists(local):
        subprocess.run(['curl', '-s', '--max-time', '30', '-o', local,
                        f'https://words.vip.cpolar.cn/audio/u1_b1b_{so}_v2.mp3'], capture_output=True)
    if not os.path.exists(local) or os.path.getsize(local) < 1000:
        print(f'{so:>3} 下载失败'); continue
    dur, head, tail, pairs = silences(local)
    bad = head > 0.30 or tail > 0.45
    print(f'{so:>3} {dur:>6.2f} {head:>6.2f} {tail:>6.2f}  {"<<< 需修" if bad else "OK"}')
    if bad:
        problems.append({'sec': 'B', 'so': so, 'dur': dur, 'head': head, 'tail': tail, 'pairs': pairs})

print(f'\n需修段数: {len(problems)}')
json.dump(problems, open('/tmp/audit/problems.json', 'w'), ensure_ascii=False, indent=1)
