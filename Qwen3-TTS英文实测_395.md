# Qwen3-TTS 英文实测（395 本地，2026-10-25）

## 启动方式（用户给的方法，实测有效）

```bash
ssh 395 'docker start qwen3-tts'
```

容器起来后服务在 `http://127.0.0.1:8001`（外面套了 `tts-proxy` 在 `:8009`，https + CORS 白名单）。
`GET /api/health`、`GET /api/voices` 可用。合成接口：

```
POST http://127.0.0.1:8001/api/synthesize/clone
{"text": "...", "language": "english", "voice_id": "alex_clean"}
→ {"file": "/api/output/<hash>.wav", "sample_rate": 24000}
GET http://127.0.0.1:8001/api/output/<hash>.wav
```

## 先纠正我上次说错的两点

| 上次的说法 | 实际情况 |
|---|---|
| 「395 无 GPU（纯 CPU）」 | **错**。`nvidia-smi` 不存在是因为它是 **AMD** 卡：`/api/health` 返回 `gpu: "AMD Radeon 8060S Graphics"`、`torch 2.12.0+rocm7.14.0`。 |
| 「音色库只有 jeff/kidf/kidm/pepf 四个中文克隆音色」 | **不完整**。实际有 **13 个**：`alex_clean / alex_golden / awtest / host_clean / host_golden / jeff / kidf / kidm / kidm2 / narrfp / narrfw / narrfw4 / pepf`。其中 `alex_clean`（Alexandr Solo Clean）、`host_clean`、`host_golden` 明显是干净的英语/俄语参考样本。 |
| 「英文是不是 excellent」 | 支持 `english`（语言码必须写 **`english`**，写 `en` 会 500：`Supported: auto/chinese/english/french/german/italian/japanese/korean/portuguese/russian/spanish`）。 |

## 实测结果

三句教材句子 × 6 个音源，whisper base.en 转写校验：

| 音源 | 第1句时长 | 第2句 | 第3句（长句） | 合成耗时 | 转写正确 |
|---|---:|---:|---:|---:|---|
| 官方教材原音 | 1.46s | 3.53s | 无 | — | ✅ 全对 |
| 有道（站点现用） | 1.78s | 2.71s | **HTTP 500** | 即时 | 第2句 Yunnan → "you now" ❌ |
| Qwen `alex_clean` | 1.76s | 2.40s | 5.12s | 1.5–4.3s | ✅ 全对 |
| Qwen `host_clean` | 1.84s | 2.40s | 4.40s | 1.3–4.0s | 第2句 Yunnan → "uni" ❌ |
| Qwen `narrfw` | 1.76s | 3.84s | 7.76s | 2.8–8.1s | ✅ 全对 |
| Qwen `kidf` | 1.68s | 3.60s | 5.52s | 2.2–5.5s | 第2句 Yunnan → "you nan" ⚠️ |

音频 A/B 页面：**https://words.vip.cpolar.cn/tts_ab/**
（临时放在 `dist/tts_ab/`，下次 `npm run build` 会被清掉，需要长期保留要说一声）

## 结论

1. **官方教材原音仍然是无可替代的基准**——真人、断句自然、专有名词准。
2. **Qwen3-TTS 的英文可用，而且明显好于现在的有道兜底**：
   - 有道在长句上直接 500（U1 那 4 句没官方音频的句子里就有长句）；
   - 有道把 `Yunnan` 念成 "you now"，这种错误对跟读的孩子是硬伤；
   - Qwen 的 `alex_clean` / `narrfw` 两句都念对了。
3. **音色要挑**：`alex_clean` 最稳（快、准），`narrfw` 最自然但慢一倍，`host_clean` / `kidf` 会在
   中文教材里的中国地名（Yunnan）上翻车——**凡是涉及地名的句子，先试 `alex_clean`**。
4. **速度**：1.3–8.1s/句（GPU 上），**不能做运行时合成**，只适合离线批量预生成静态 mp3。
5. 容器空闲 600 秒会卸载模型（`idle.timeout_seconds=600`），要长期挂着得自己兜。

## 推荐用法

- 官方教材原音优先（U1 已 38/42）；
- 缺的几句用 **Qwen `alex_clean`（language=english）** 离线预生成，走和官方音频一样的 `audio_url` 通道；
- 生成脚本思路：`sentences` 表取 `audio_url = ''` 的句子 → 逐句 POST → 下载 wav → 转 mp3（128k）
  → 传 `public/audio/` → 回填 `audio_url`。
