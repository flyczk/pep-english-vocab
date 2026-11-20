# U1 官方音频 · 重做说明（ASR 对齐版）

> 2026-10-24 03:20 · 替代此前失败的版本。本文件说明**这次为什么对、怎么验、还差什么**。

## 一、上一轮为什么全错（已查明，不是猜测）

用 whisper 转写整段音频后，第一个词是 `Section B`，不是 `Today`。官方音频的结构是：

| 时间 | 内容 | 我上一轮的处理 |
|---|---|---|
| 0–21s | `Section B. What can we learn from holiday experiences?`<br>`Section B. Activity 1B. Read Vincent's diary entries about his holiday. Then answer the questions.`<br>`The 17th of July.` | **我当成正文，从 0.71s 开始切** ❌ |
| 21s–80s | 7 月 17 日正文 12 句 | 整体错位 |
| ~80s | `The 18th of July.`（日期朗读） | **没算进去，又错一次** ❌ |
| 81s–132s | 7 月 18 日正文 12 句 | 继续错位 |

我上一轮用「静音检测 + 句长比例猜边界」，**从头到尾没有任何内容验证**，所以整体错位也没被自检发现——因为错位后每段时长依然"看起来合理"。

## 二、这次的做法

1. `ffmpeg` 转 16kHz 单声道 wav
2. `whisper-cli`（whisper.cpp）**词级时间戳**转写整段 → `/tmp/u1_asr.json`（337 个词段）
3. 把 24 句各自分词，与 ASR 词序列做 `difflib.SequenceMatcher` 对齐 → 反推每句首词的起、末词的止
4. 按对齐时间切分（首尾各留 0.12s / 0.18s 余量）
5. **每一段切完再单独跑一次 whisper**，把转写结果与句子原文算相似度 —— **这才是真正的内容校验**

## 三、这轮的结果（逐段 ASR 回验）

| 判定 | 句数 | 说明 |
|---|---|---|
| 相似度 1.00（完全一致） | **19 句** | 20、21、22、24、25、26、27、29、30、31、32、33、34、35、36、39、40、41、42 |
| 0.92–0.97（文本与录音微差） | 3 句 | 23、28、38 |
| 0.80（差异明显） | 1 句 | 19 |
| 无官方音频 | 1 句 | 37 |

**关键：19 句是词对词完全一致的**，这不是"时长看起来合理"，而是转写回来一个字都不差。

## 四、剩下 5 句的真实情况（不是切分错误，是录音本身与课本不同）

上一轮独立复核（有课本扫描原图目验）已经得出过结论：**官方录音是按早期文稿录的，教材修订后没重录**。这次 ASR 完全印证了这一点：

| 句 | 课本（库中文本） | 录音实际念的 | 相似度 | 处理 |
|---|---|---|---|---|
| 19 | Today was our first day **to visit** Moscow. | Today was our first day **visiting** Moscow. | 0.80 | **保留课本文本 + 官方音频**（听感差异小，语法都通） |
| 23 | As we **walked** through the halls, the tour guide told **us** stories about the war. | As we **walk** through the halls, the tour guide told **the** stories about the war. | 0.93 | 同上 |
| 28 | I **liked** the ice cream there, so I ate a lot of it. | I **like** the ice cream there, so I ate a lot of it. | 0.92 | 同上 |
| 38 | …we arrived **at a school** and met a group of Russian students. | …we arrived **at school** and met a group of Russian students. | 0.97 | 同上 |
| 37 | **It was fantastic!** | （录音里是 **We saw some fantastic buildings there.**） | — | **已清空 audio_url，降级 TTS** |

**为什么 37 句必须降级**：录音里这一整句不存在，如果硬塞一段音频进去，孩子会听到与文字完全不同的内容。其它 4 句只是个别词不同，整句主体一致，所以保留官方音频。

**这里有一个需要你决定的取舍**：如果你更看重"文字必须与声音一字不差"，我可以把这 4 句也降级 TTS（代价是 4 句变机器音）；如果你更看重"教材文本与考试一致"，现在这样就是最优解。**我倾向现在这样**，因为教材是考试依据，而 4 处差异学生跟读时基本感知不到。

## 五、怎么自己验（不用信任我）

打开 `U1官方音频_逐句核验.html`：
- 每句下方直接显示 **ASR 听到的内容**，与上方课本文本逐字对照
- 点 ▶ 用耳朵复核
- 「顺序播放」可以连听全篇（自动跳过 37 句）

**这个页面就是证据本身**：如果哪句的 ASR 文字与课本文字明显不符，你一眼就能看到，不需要我说"没问题"。

## 六、线上状态

| 项 | 状态 |
|---|---|
| 音频文件 | `/var/www/words/public/audio/u1_b1b_{19..36,38..42}.mp3`，共 23 个（旧版 24 个已覆盖/删除） |
| DB | `sentences.audio_url` 23 句有值，句 37（id 157）为空 |
| 前端 | 已重新 `npm run build`，`dist/audio/` 23 个文件 |
| 行为 | 有官方音频的句子播人声；37 句和 Section A 的 18 句自动走 TTS |
| 回滚 | `UPDATE sentences SET audio_url='' WHERE lesson_id=82 AND source LIKE '%Section B%';`（一行回到 TTS） |

## 七、可复用的资产（已固化，不怕重启丢）

`audio_assets/` 目录：
- `u1_sectionB_1b.mp3` — 官方原音频（132.9s，3.0MB）
- `u1_asr.json` — 整段词级转写（337 段，含时间戳）
- `u1_aligned.json` — 24 句对齐结果（起止时间 + 每句 ASR 文本 + 相似度）
- `meta.json` — 切分产物的元数据（含逐段回验结果）
- `resources_part_100.json` — **87 个官方资源清单**（8 单元听力 + 单词音频 + 精品课）

脚本：`align_u1_by_asr.py`（对齐）、`cut_and_verify_u1.py`（切分+回验）。
模型：`~/whisper-models/ggml-base.en.bin`（141MB）。

**这套流程可以直接复用到 U3 和其它单元**，只要换音频和句子文本表。

## 八、下一步建议

1. 你先听核验页，确认 19/23/28/38 这 4 句的取舍（保留官方音频 vs 降级 TTS）
2. 确认后我按同一流程做 **U3 Section B 1b（33 句）**
3. 单词音频最后做，但要注意：`Vocabulary in Each Unit` 是整单元词汇连读，**按词切分比按句更难**，可能需要逐个词的时间戳（whisper 对孤立单词的识别不如句子稳）
