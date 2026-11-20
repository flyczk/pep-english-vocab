# 全站发音替换评估 · TTS vs 官方音频（2026-10-24）

## 一、现状确认：全站 100% 外接 TTS（机器音）

唯一发音入口是 `src/utils/audioPlayer.ts` 的 `playWordAudio()`，单词和句子都走它：

| 引擎 | 地址 | 性质 |
|---|---|---|
| 有道 | `dict.youdao.com/dictvoice` | 在线 TTS |
| 百度 | `fanyi.baidu.com/gettts` | 在线 TTS |
| Bing | `cn.bing.com/dict/Speech` | 在线 TTS |
| 浏览器 | `speechSynthesis` | 本地兜底 |

默认链路：有道 → 百度 → Bing → 浏览器。**四个都是合成音，没有人声语调**，句子朗读时是"一个字一个字蹦"的感觉——这就是用户反馈"发音质量不行"的根源。

调用点：`WordListPage` / `StudyPage` / `VocabularyPage` / `SentenceListPage` / `SentencePage` / `SentenceTab` / `SentenceDrillPage`（句子侧统一 `speed: 0.95`）。

## 二、官方音频调研结论（basic.smartedu.cn）

**已确认能拿到的东西：**
- 国家中小学智慧教育平台「同步课堂」有完整官方听力资源，粒度**精确到板块**：`Unit 1 Section A, 1b` / `1c` / `Pronunciation, 1` / `2a` / `2d` / `Section B, 1b` ……8 个单元全覆盖，出品方"人民教育出版社"。
- 资源用 UUID 标识（例：`a73cb075-1868-a559-c629-73ec20caf9e9` = Unit 1 Section A, 1b），API 域名 `x-api.ykt.eduyun.cn`，资源文件在 `r1-ndr.ykt.cbern.com.cn` 等 CDN。
- 顺带把单元标题全部核实了：U1 Happy Holiday / U2 Home Sweet Home / U3 Same or Different? / U4 Amazing Plants and Animals / U5 What a Delicious Meal! / **U6 Plan for Yourself** / U7 When Tomorrow Comes / **U8 Let's Communicate!**

**三个硬约束（决定它不能直接替换）：**
1. **粒度是"整段"不是"按句"**：一个资源 = 整个 1b 对话朗读。我们的句库是"点哪句读哪句"，所以必须**按句切分**，需要每句的时间戳。
2. **不能外链**：CDN 地址有时效/防盗链，必须下载到自己服务器（磁盘 + 带宽 + 维护）。
3. **合规风险（必须说清）**：平台资源有使用条款，把官方音频扒取后放到自己的商业服务里供用户播放，属于灰色地带。**这条要用户自己判断并承担责任**，我不建议在没弄清楚条款前全量搬运。

## 三、三条路线对比

| | 路线 1：官方音频 | 路线 2：神经网络 TTS | 路线 3：混合（推荐） |
|---|---|---|---|
| 音质 | 真人录音，最好 | 接近真人（比有道/百度好一个档次） | 两者兼得 |
| 版权风险 | **有**，需用户确认 | 无 | 可控（范围可限定） |
| 覆盖新句子 | 每句都要下载+切分 | 自动覆盖，零维护 | 新句子自动有音 |
| "整篇连读"体验 | ✅ 独有 | ❌ | ✅ |
| 工作量 | 大：60–80 个音频下载 + 160+ 句切分标注 + 前端改造 | **小：加一个引擎选项，1–2 小时** | 先 2 后 1 |
| 见效速度 | 慢（按单元逐步） | **当天上线** | 当天见效 |

## 四、我的建议：先做路线 2，路线 1 作为增强

**理由**：用户抱怨的是"发音质量不行"，路线 2 直接解决这个核心问题，且零风险、当天生效、自动覆盖以后新增的所有句子。路线 1 的独特价值（教材原声 + 整篇连读）值得做，但应该作为**增值维度**，而不是替换基础能力。

**路线 2 具体做法**：
- 引入 Edge/Azure 神经网络语音（`en-US-AriaNeural`、`en-US-GuyNeural` 等），微软 Edge 朗读同源
- 服务端加一个 TTS 通道（复用现有 `/api/tts/proxy` 架构，加一个 `engine=edge`），解决浏览器跨域 + GEC 令牌问题
- 前端"设置 → 发音引擎"里加一项「微软神经网络（推荐）」，并把它设为默认首选
- 保留有道/百度/Bing/浏览器作为降级链

**技术备注**：Edge TTS 的 WebSocket 端点 `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` 需要动态计算的 `Sec-MS-GEC` 令牌（由时间戳 MD5 派生），我已验证端点可达但令牌算法需正确实现（社区 `edge-tts` / `msedge-tts` 库已解决，可直接用在服务端）。

**路线 1 试点方案（用户同意后）**：
- 只做 U1 + U3 两个单元的 Section B 1b（日记体 + 论坛帖，各 24/33 句）
- 用静音检测（VAD）自动切分 + 人工校准关键边界
- `sentences` 表加 `audio_url` / `audio_start` / `audio_end` 字段
- 前端逻辑：有官方音频 → 播官方；没有 → 走 TTS
- 试点跑通、效果和版权都确认没问题，再决定是否铺开到 8 个单元

## 五、需要用户决策的一件事

**路线 1 涉及把教育部平台资源下载到自有服务器，存在合规不确定性。** 如果你的使用场景是家庭自用/孩子学习，风险很低；如果这个站点未来给更多家庭用，建议先看清楚平台使用条款，或者只用路线 2。

我的建议：**先上路线 2，路线 1 等你确认版权边界后再试点。**
