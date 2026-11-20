#!/usr/bin/env python3
"""用 395 上的 Qwen3-TTS 批量补句子音频（离线预生成，不要运行时调）。

前提
----
1. ssh 395 'docker start qwen3-tts'   （容器空闲 600s 会卸载模型，长时间不用要重新拉）
2. 服务在 http://127.0.0.1:8001（外面的 :8009 是 https + CORS 白名单代理，只给同传页面用）

接口（2026-10-25 实测）
----
POST /api/synthesize/clone   body {"text","language","voice_id"} -> {"file":"/api/output/<hash>.wav"}
GET  /api/output/<hash>.wav
- language **必须写 "english"**，写 "en" 会 500
  可选：auto chinese english french german italian japanese korean portuguese russian spanish
- 音色库 13 个：alex_clean alex_golden awtest host_clean host_golden jeff kidf kidm kidm2
  narrfp narrfw narrfw4 pepf
- **教材里带中国地名的句子一律用 alex_clean**（实测 host_clean 把 Yunnan 念成 uni、
  kidf 念成 you nan、有道念成 you now；alex_clean 和 narrfw 念对）
- 速度 1.3–8.1s/句，**只能离线批量跑**

用法（在 395 上跑，产出 wav 后再 ffmpeg 转 mp3 传到 web）
----
python3 tts_qwen_batch.py sentences.tsv out_dir [voice]
  sentences.tsv 每行： <输出名>\t<英文句子>
"""

import json
import os
import sys
import time
import urllib.request

BASE = "http://127.0.0.1:8001"


def synth(text: str, voice: str, language: str = "english"):
    body = json.dumps({"text": text, "language": language, "voice_id": voice}).encode()
    req = urllib.request.Request(
        BASE + "/api/synthesize/clone",
        data=body,
        headers={"content-type": "application/json"},
        method="POST",
    )
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=900) as r:
        info = json.loads(r.read())
    name = info["file"].split("/")[-1]
    with urllib.request.urlopen(BASE + "/api/output/" + name, timeout=180) as r:
        data = r.read()
    return time.time() - t0, data


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    tsv, out = sys.argv[1], sys.argv[2]
    voice = sys.argv[3] if len(sys.argv) > 3 else "alex_clean"
    os.makedirs(out, exist_ok=True)
    for line in open(tsv, encoding="utf8"):
        line = line.rstrip("\n")
        if not line.strip():
            continue
        name, text = line.split("\t", 1)
        try:
            dt, data = synth(text, voice)
            path = os.path.join(out, f"{name}.wav")
            open(path, "wb").write(data)
            print(f"{name:20s} {dt:5.2f}s {len(data)//1024:5d}KB -> {path}")
        except Exception as e:  # noqa: BLE001
            print(f"{name:20s} FAIL {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
