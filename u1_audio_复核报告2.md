# Unit 1（人教版 2024 八上 Happy Holiday）官方音频按句切分 — 独立复核报告

- 复核日期：2026-10-25
- 复核对象：words.vip.cpolar.cn 线上站点，lesson_id=82，共 42 句（38 句配音频，4 句无音频）
- 复核方法：从服务器 DB 直接导出句子清单 → 逐段下载线上音频 → whisper.cpp（ggml-base.en）独立 ASR 转写 → 与课本文本分词后算 difflib.SequenceMatcher 相似度 → 与原整段音频的历史 ASR 结果交叉验证
- 复核性质：只读操作，未修改任何线上数据或文件

---

## 1. 结论摘要

| 判定 | 段数 | 占比 |
|---|---|---|
| 转写与文本完全一致（相似度 1.0） | 29 | 76% |
| 基本一致（相似度 ≥ 0.85） | 5 | 13% |
| 不一致（相似度 < 0.85） | 4 | 11% |

**表态：38 段音频没有发现切分错误（没有任何一段听到的是相邻句或别句的内容），可以放心使用。**
4 段相似度低于 0.85 的片段逐一核查后，全部属于"录音原文与教材文本措辞不同"（录音口语与教材书面语的正常差异），而非音文错位。其中 3 段（so3、so6、so8）如追求音文逐词对应，建议在界面上标注录音原文或微调，详见第 3 节；不处理也不影响学习使用。

4 个无音频例外句（sort_order 2、4、18、37）核实：服务器上确无对应文件，且原整段录音 ASR 中确实不含这些句子的内容，排除合理。

---

## 2. 逐句对照表

相似度为分词（小写、去标点）后的 difflib.SequenceMatcher 比值。ASR 转写为 whisper-cli（base.en 模型）原始输出。

| sort_order | 课本文本 | ASR 转写 | 相似度 | 判定 |
|---|---|---|---|---|
| 1 | Where did you go on holiday? | Where did you go on holiday? | 1.0 | 完全一致 |
| 2 | I didn't go anywhere special, but I tried something new — I worked as a tour guide at a museum. | —（无音频） | — | 例外句（见第 4 节） |
| 3 | Did you do anything interesting on your holiday? | So, did you do anything interesting there? | 0.667 | 不一致（录音措辞不同，非切分错误） |
| 4 | No, nothing special. But I met someone interesting. | —（无音频） | — | 例外句（见第 4 节） |
| 5 | Did you go anywhere interesting? | Stick. Did you go anywhere interesting? | 0.909 | 基本一致（头部有约一个音的疑似带入） |
| 6 | Yes, I went to Yunnan. | Yes, I went to Yunnan with my family. | 0.769 | 不一致（录音一句话合并口播，非切分错误） |
| 7 | Did you go with anyone? | Did you go with anyone? | 1.0 | 完全一致 |
| 8 | Yes, I went with my family. | Yeah, I went with my family. | 0.833 | 不一致（口播 Yeah vs 教材 Yes，非切分错误） |
| 9 | Did you eat anything special? | Did you eat anything special? | 1.0 | 完全一致 |
| 10 | Yes, we did! Everything tasted good, especially the steamed chicken soup. Everyone loved it. | Yes, we did. Everything tasted good. Especially the steamed chicken soup. | 0.88 | 基本一致（录音缺 "Everyone loved it."） |
| 11 | How was your holiday? | How was your holiday? | 1.0 | 完全一致 |
| 12 | It was fantastic. | It was fantastic! | 1.0 | 完全一致 |
| 13 | Yes, we stayed in the old town for a few days, and we enjoyed it very much. | Yes, we stayed in the old town for a few days and we enjoyed it very much. | 1.0 | 完全一致 |
| 14 | Did you visit Yulong Mountain? | Did you visit Yulong Mountain? | 1.0 | 完全一致 |
| 15 | It is! It just took my breath away. | It is. It just took my breath away. | 1.0 | 完全一致 |
| 16 | What about you? | What about you? | 1.0 | 完全一致 |
| 17 | I just stayed at home to read, play games, and relax, but it was still fun. | I just stayed at home to read, play games, and relax. But it was still fun. | 1.0 | 完全一致 |
| 18 | How was your summer holiday? | —（无音频） | — | 例外句（见第 4 节） |
| 19 | Today was our first day to visit Moscow. | Today was our first day visiting Moscow. | 0.8 | 不一致（录音用 visiting，教材用 to visit，非切分错误） |
| 20 | The weather was fine and everyone felt excited to visit some famous places in Russia. | The weather was fine and everyone felt excited to visit some famous places in Russia. | 1.0 | 完全一致 |
| 21 | In the morning, we went to the Victory Museum. | In the morning, we went to the Victory Museum. | 1.0 | 完全一致 |
| 22 | The Russian people built this museum to remember their fight against the Nazis during World War II. | The Russian people built this museum to remember their fight against the Nazis during World War II. | 1.0 | 完全一致 |
| 23 | As we walked through the halls, the tour guide told us stories about the war. | As we walk through the halls, the tour guide told us stories about the war. | 0.933 | 基本一致 |
| 24 | In one hall, I saw an artwork with thousands of glass "tears" falling down. | In one hall, I saw an artwork with thousands of glass tears falling down. | 1.0 | 完全一致 |
| 25 | It reminds us that war is terrible and peace does not come easily. | It reminds us that war is terrible and peace does not come easily. | 1.0 | 完全一致 |
| 26 | We should not forget that. | We should not forget that. | 1.0 | 完全一致 |
| 27 | At noon, we had lunch at a restaurant near the park. | At noon, we had lunch at a restaurant near the park. | 1.0 | 完全一致 |
| 28 | I liked the ice cream there, so I ate a lot of it. | I like the ice cream there, so I ate a lot of it. | 0.923 | 基本一致（录音口播 like，教材 liked） |
| 29 | But, during dinner, I didn't feel like eating because I felt sick. | But during dinner, I didn't feel like eating because I felt sick. | 1.0 | 完全一致 |
| 30 | So now, I just want to get a good night's sleep. | So now, I just want to get a good night's sleep. | 1.0 | 完全一致 |
| 31 | It rained last night, so this morning the air was fresh and cool. | It rained last night, so this morning the air was fresh and cool. | 1.0 | 完全一致 |
| 32 | I felt much better today. | I felt much better today. | 1.0 | 完全一致 |
| 33 | We took the Moscow Metro to travel around. | We took the Moscow Metro to travel around. | 1.0 | 完全一致 |
| 34 | The metro stations are really beautiful. | The metro stations are really beautiful. | 1.0 | 完全一致 |
| 35 | Sometimes I felt like I was walking inside a palace. | Sometimes I felt like I was walking inside a palace. | 1.0 | 完全一致 |
| 36 | After that, we went to Red Square. | After that, we went to red square. | 1.0 | 完全一致 |
| 37 | It was fantastic! | —（无音频） | — | 例外句（见第 4 节） |
| 38 | In the afternoon, we arrived at a school and met a group of Russian students. | In the afternoon, we arrived at school and met a group of Russian students. | 0.966 | 基本一致（录音口播 at school，教材 at a school） |
| 39 | We played games and soon became friends. | We played games, and soon became friends. | 1.0 | 完全一致 |
| 40 | Later, someone took out his accordion, and soon everyone got together to sing and dance. | Later, someone took out his accordion, and soon everyone got together to sing and dance. | 1.0 | 完全一致 |
| 41 | We were so happy that we didn't notice the time. | We were so happy that we didn't notice the time. | 1.0 | 完全一致 |
| 42 | It was such a good experience! | It was such a good experience. | 1.0 | 完全一致 |

---

## 3. 不一致段的详细分析

对 4 段低分片段（so3、so6、so8、so19）和 2 个值得说明的边界段（so5、so10），用**原整段音频的独立 ASR**（Section A：u1_a_1b/1c/2a/2d_asr.json；Section B：audio_assets/u1_asr.json）交叉验证，逐一定性：

### so3（0.667）— 录音措辞与教材不同，**非切分错误**
- 教材：Did you do anything interesting **on your holiday**?
- 片段 ASR：So, did you do anything interesting **there**?
- 原整段录音（Section A 1b 对话二）原文："I see. **So, did you do anything interesting there?** Yes. I went to a strawberry festival..."
- 定性：片段与录音原文逐词吻合，切分边界正确；是录音口播与教材书面文本措辞不同（结尾 there vs on your holiday，开头多 So）。
- 建议：可在界面标注录音原文，或接受现状（学生听到的是真实对话，语义一致）。

### so6（0.769）— 录音一句话合并口播，**非切分错误**
- 教材：Yes, I went to Yunnan.
- 片段 ASR：Yes, I went to Yunnan **with my family**.
- 原整段录音（Section A 2a/2d）原文："Did you go anywhere interesting? **Yes. I went to Yunnan with my family.**"
- 定性：录音中说话人一口气说完整句，没有教材中 "Did you go with anyone?" 这一问一答的独立口播；片段完整截取了录音原句，边界正确。多出的 "with my family" 来自录音原句本身，不是串入相邻句（so8 的内容另取自 1b 对话一，见下）。
- 建议：若要求音文逐词对应，可将该片段尾部截短至 "Yes, I went to Yunnan."；否则建议界面标注录音原文。

### so8（0.833）— 口播用词差异，**非切分错误**
- 教材：**Yes**, I went with my family.
- 片段 ASR：**Yeah**, I went with my family.
- 原整段录音（Section A 1b 对话一，登黄山场景）原文："Did you go with anyone? **Yeah. I went with my family.**"
- 定性：该片段内容与教材句语义完全一致，取自 1b 对话一的原口播（该对话中恰好有这组问答），仅 Yes/Yeah 一词之差，且该差异是录音本身如此。
- 建议：无需处理，属正常口语与书面差异。

### so19（0.8）— 语法措辞差异，**非切分错误**
- 教材：Today was our first day **to visit** Moscow.
- 片段 ASR：Today was our first day **visiting** Moscow.
- 原整段录音（Section B 日记）原文："The 17th of July. Today was our first day **visiting** Moscow."
- 定性：片段与录音原文逐词吻合，切分正确；录音口播为 visiting，教材文本为 to visit。
- 建议：无需处理，或在界面标注录音原文。

### so5（0.909，基本一致）— 头部有约一个音的疑似带入
- 片段 ASR：**Stick.** Did you go anywhere interesting?
- "Stick." 疑似上一句 "It was fantastic." 的词尾 /tæstɪk/ 被切进片段开头后被 ASR 误识，也可能是杂音。片段核心句完整、正确，时长 3.06s（该句正常口播约 1.5–2s），头部确实多出约 1s。
- 建议：可将片段起点后移约 0.5–1s 去除头部带入；不影响使用。

### so10（0.88，基本一致）— 录音缺少教材中的一句
- 教材含 "**Everyone loved it.**"，原整段录音（2a/2d）中该处口播为 "Especially the steamed chicken soup." 后直接进入 "What about you?"，录音里没有这句话。片段完整截取了录音内容，未串入下一句，切分正确。

### 其余低分段（so23 0.933 / so28 0.923 / so38 0.966）
均为 walked/walk、liked/like、at a school/at school 一类的口播与文本细微差异，且与原整段录音 ASR 一致，切分全部正确。

---

## 4. 4 个无音频例外句的验证

**服务器文件核查**（/var/www/words/public/audio/）：`u1a_2*`、`u1a_4*`、`u1a_18*`、`u1_b1b_37*` 均 NOT FOUND，与 DB 中 audio_url 为空一致。

**原整段录音 ASR 核查**（4 段 Section A 音频 + 1 段 Section B 音频的全量转写）：

| sort_order | 教材句 | 核查结果 |
|---|---|---|
| 2 | I didn't go anywhere special, but I tried something new — I worked as a tour guide at a museum. | 录音中不含。"tour guide""museum" 的命中均来自 Section B 其他句子（the tour guide told... / the Victory Museum），无本句内容。录音对应处口播为 "No. Not this holiday. I did nothing special..."，差异过大，排除合理。 |
| 4 | No, nothing special. But I met someone interesting. | 录音中 "nothing special" 的上下文是 "I did nothing special. I just stayed at home..."（即 so17 的内容），"met someone interesting" 完全未出现，本句确不在录音中。 |
| 18 | How was your summer holiday? | 全部录音中均无 "summer holiday"，本句确不在录音中（录音中只有 "How was your holiday?"，即 so11）。 |
| 37 | It was fantastic! | 教材此处（Red Square 之后）录音实际口播为 "**We saw some fantastic buildings there.**"，与教材句差异过大，排除合理。仅有的 "it was fantastic" 命中来自 so11/so12 的对话，内容归属明确。 |

结论：4 个例外的无音频处理属实且合理，不存在"漏配"。

---

## 5. 检查方法与局限

### 做了什么
1. 通过 ssh 从服务器 SQLite 直接导出 lesson_id=82 全部 42 句（sort_order、en、audio_url），未依赖站点页面。
2. 从线上站点逐一下载全部 38 段音频（curl），ffmpeg 转 16kHz 单声道 wav。
3. 用 whisper.cpp（ggml-base.en，与被复核系统的方法相互独立，不共用其切分/回验代码）对 38 段全量转写，**未抽样**。
4. 分词小写后用 difflib.SequenceMatcher 计算转写与教材文本的相似度，按 0.85 阈值分级。
5. 对所有 <0.85 的片段及个别边界段，引用/复用原整段音频的独立 ASR 结果（Section A 的 1b/1c/2a/2d、Section B 的整段日记）做交叉验证，逐一定性为"切分错误"或"录音与文本措辞差异"。
6. 对 4 个无音频例外句：核实服务器上无对应文件，并在整段录音 ASR 全文中搜索其关键词，确认录音中确无这些句子。
7. 抽查关键片段时长（ffprobe），与内容长度比对，辅助判断切分边界。

### 没做什么 / 局限
1. **ASR 模型较小**：base.en 是轻量模型，对个别词的转写可能有误（如 so23 的 walked/walk、so8 的 Yes/Yeah 实际无法完全区分是 ASR 误差还是录音确实如此）。因此"基本一致"段的个别差异定性存在少量不确定性。但相似度 1.0 的 29 段意味着 ASR 逐词复现了教材文本，这本身是音文对应的强证据。
2. **未做人工听音**：报告完全基于机器 ASR，未有人耳逐段听审。对 so5 开头 "Stick." 的来源（上一句尾音 vs 杂音）只能给出推测。
3. **未验证音频教学属性**：未检查音量、降噪、码率、发音清晰度等音频质量维度，仅验证音文对应关系。
4. **so6/so8 的素材来源推断**：根据整段录音 ASR 判断 so8 片段取自 1b 对话一、so6 取自 2a 对话，该结论基于 ASR 文本匹配，未做声纹级确认。
5. **未测其他 Unit**：本报告结论仅覆盖 Unit 1（lesson_id=82）。

### 综合表态
38 段中未发现任何"听到别句内容"的切分事故，此前的音文不对应问题在本 Unit 未复现；4 段低相似度均可归因于官方录音与教材文本本身的措辞差异。**可放心使用；如追求完美，可选择性优化 so3/so6（标注录音原文或截短 so6 尾部）与 so5（截短头部约 1s），共 3 处，非必须。**
