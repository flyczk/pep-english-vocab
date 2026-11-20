# HANDOFF · 单词学习站句子模块（2026-10-25 更新）

## 一句话口令
**「接着干 words」** = 继续按既定流程推进句子模块。

## 最新状态（2026-10-25）
- **U1 全部 42 句已配官方人声 38 句**（独立复核 Agent 全量转写验证：29 段逐词一致、无一切分错误；4 句官方录音无此句降级 TTS）。报告 `u1_audio_复核报告2.md`
- **技能已固化**：`~/.workbuddy/skills/textbook-audio-sentence-split/SKILL.md`（做 U2-U8 音频照此流程）
- **分类精简已上线**：category 两类（重点考点 103 / 常用句型 57），考点族 11 个，extended 21 句退出复习队列
- **下一批候选**：U3 Section B 1b 音频（33 句，流程同 U1）/ U1 单词音频 / U2-U8 句子补录

## ⚠️ 官方音频：方法已验证可用（更新）
第一棒失败（静音检测猜边界），第二棒成功（**ASR 词级时间戳对齐 + 逐段回验**）。
- 技能文档 `~/.workbuddy/skills/textbook-audio-sentence-split/SKILL.md` 是唯一权威流程，含登录/下载/对齐/回验/防缓存全部细节
- **铁律：更新音频必须换文件名加版本号**（站点 30 天缓存）；**每段必须 ASR 回验 ≥0.85 才入库**
- Section A 类 GF 独有例句不在对话音频里，用锚点词序列人工定位；全局搜索会被 ASR 专有名词错误误导
- 复核方式：独立复核 Agent 全量下载线上音频逐段转写比对（用户认可此模式）

## 当前进度（可立即续接）

### 已完成
- **架构字段**：`sentences` 表已加 `genre` / `section_code` / `tier`，存量 136 句全部回填，server.js 三处句子 SELECT 已返回新字段（服务已重启生效）
- **U3**（lesson_id 84）：33 句 + 21 道挖空题，复核修订完毕
- **U1 Section B 1b 日记体**（lesson_id 82）：24 句 + 9 道挖空题，core 18 / extended 6
- 全库句子 160 句；备份链完整（`app.db.bak.20261024-before-schema`、`app.db.bak.20261024-before-u3-add` 等）

### 下一步（按优先级）
1. **补 U1 的 Section A 句型缺口**：`something interesting` 形容词后置（教辅称本单元最高频考点，目前零覆盖）
2. **录 U2 的 Section B 1b**（lesson_id 83，体裁待确认）
3. 之后 U4–U8 的 Section B 1b
4. Section B 3a–3c 写作范本（P0，平台完全空白）
5. 1b/1c 听力对话（P1）

### 待用户确认
- U3 对照表的页码（P26–P27）需用户翻书核对——原图取证发现教辅页码会串版

## 铁律（每次录入前必读）
1. **只有课本扫描原图/纸质教材是最终依据**。多个公众号/教辅一致 ≠ 教材一致（同源早期文稿）。
   原图 URL 模式：`https://images.szxuexiao.com/uploadimages/keben2025/rjb8njyingyus_2024/rjb8njyingyus_2024-0NN.jpg`，P_n = `-0(n-1).jpg`
   官方录音：`https://www.pep.com.cn/yyszptzy/8s07Unit1SectionB1b.mp3`（按此模式找其它板块）
2. **挖空题答案必须唯一**：挖介词/连词/固定搭配关键词；禁止挖"形容词前""整个宾语""缺比较对象的 more"
3. **hint 逐题定制**，不套模板
4. 保留英式拼写（colourful / practise / humour）；不"纠正"`than me`
5. drill 的 `exam_point` 必须与所属 sentence 一致
6. 二战/反纳粹等教材原文可收录，但不选作例句或考题
7. **不确定的才交独立复核会话**（全新上下文、不给结论）；确定的直接推进

## 技术备忘
- DB：`/var/www/words/server/data/app.db`；服务 systemd `words-api`，重启用 `pkill -f 'node /var/www/words/server/server.js'`（等约 10 秒再测，太早会 curl 000）
- 构建必须 Node 22：`export PATH=$HOME/.local/node22/bin:$PATH && npm run build`
- **本次未改前端，未重新构建**；前端判分已大小写不敏感（`SentenceDrillPage.tsx` 的 `norm()`）
- 线上实测方法：本地生成 token + ISO 过期时间 → INSERT `sessions` → `curl -H 'Authorization: Bearer <token>'` → 用完 DELETE
  （expires_at 必须是 ISO 8601 带 Z，写 `datetime('now','+1h')` 会判"登录已过期"）
- ssh 必须前台执行（后台会被沙箱拦截）；ssh 别名 `web`
- 脚本都在 workspace：`add_u*_sectionB1b.sql`、`fix_u*_review.sql`、`gen_drills.py`

## ⚠️ 官方音频：第一棒失败，已停止（2026-10-24）
**U1 Section B 1b 的 24 段音频经用户试听确认"语音与句子对不上"**，不要再修补我的切分结果。
完整现场、坑、回滚方案、接手建议全部写在 **`交接文档_U1官方音频_失败与现状.md`**（接手方先读它）。
- 当前线上仍挂着这 24 句的 `audio_url`，**建议执行该文档 §0 的一行 SQL 回滚**（需用户同意）。
- 官方原音频是好的：`/tmp/u1_sectionB_1b.mp3`（132.9s）。登录/下载/落盘链路已打通，可复用。
- 正确的切分方式：ASR 强制对齐（whisperX 词级时间戳）或人工听觉校准，**并且必须加"每段转写 vs 原文相似度 ≥0.85"的校验闸门**。
