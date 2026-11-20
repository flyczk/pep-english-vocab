#!/usr/bin/env python3
"""逐句核验：DB 句子文本 vs 部署音频的 ASR 转写，找出「文本与语音不一致」。"""
import difflib
import json
import os
import re
import subprocess

MODEL = "/Users/jeffchen/whisper-models/ggml-base.en.bin"
BASE = "https://words.vip.cpolar.cn"
OUT = "/tmp/audit_clips"
os.makedirs(OUT, exist_ok=True)


def norm_words(text: str):
    text = text.lower().replace("—", " ").replace("–", " ")
    text = re.sub(r"[^a-z0-9' ]+", " ", text)
    return [w for w in text.split() if w]


def asr(path: str) -> str:
    r = subprocess.run(
        ["whisper-cli", "-m", MODEL, "-f", path, "-l", "en", "-nt"],
        capture_output=True, text=True,
    )
    return r.stdout.strip()


rows = []
for line in open("/tmp/u1_list.txt", encoding="utf-8"):
    line = line.rstrip("\n")
    if not line.strip():
        continue
    sid, order, en, url = line.split("|", 3)
    rec = {"order": int(order), "id": sid, "en": en, "url": url.strip(),
           "heard": "", "ratio": None, "missing": [], "extra": []}
    if not rec["url"]:
        rows.append(rec)
        continue
    local = os.path.join(OUT, f"{rec['order']:02d}.mp3")
    subprocess.run(["curl", "-s", "-o", local, BASE + rec["url"]], check=False)
    heard = asr(local)
    rec["heard"] = heard
    a, b = norm_words(en), norm_words(heard)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag in ("delete", "replace"):
            rec["missing"] += a[i1:i2]
        if tag in ("insert", "replace"):
            rec["extra"] += b[j1:j2]
    rec["ratio"] = round(sm.ratio(), 3)
    rows.append(rec)

print("=" * 90)
bad = 0
for r in rows:
    if r["ratio"] is None:
        continue
    if r["ratio"] >= 0.999 and not r["missing"] and not r["extra"]:
        continue
    bad += 1
    print(f"\n[{r['order']:>2}] id={r['id']} ratio={r['ratio']}")
    print(f"  文本: {r['en']}")
    print(f"  听到: {r['heard']}")
    if r["missing"]:
        print(f"  缺(文本有·语音无): {r['missing']}")
    if r["extra"]:
        print(f"  多(语音有·文本无): {r['extra']}")

print("\n" + "=" * 90)
ok = sum(1 for r in rows if r["ratio"] is not None and r["ratio"] >= 0.999
         and not r["missing"] and not r["extra"])
noaudio = sum(1 for r in rows if r["ratio"] is None)
print(f"合计 {len(rows)} 句：完全一致 {ok}，有差异 {bad}，无官方音频 {noaudio}")
json.dump(rows, open("/tmp/audit_result.json", "w"), ensure_ascii=False, indent=1)
