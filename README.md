# 人教版中学英语单词库（初中 + 高中）· 工作区

- GitHub：https://github.com/flyczk/pep-english-vocab
- Gitee（私有镜像）：https://gitee.com/jeffchen5/pep-english-vocab

覆盖人教版初中、高中全部最新英语单词，配套教材原文核对、官方录音切片、单词音频对齐、挖空题生成与点读站（`words.vip.cpolar.cn`）的相关脚本和文档。

## 资料策略

- **内容全量入库**：课本扫描页、截图、录音切片、TSV/JSON 数据、SQL、脚本、文档全部纳入版本控制。
- **配置保持轻量**：不引入构建系统、不装额外依赖；同步只要 `./sync.sh` 一条命令。
- 唯一不入库的是 `.workbuddy/`（Agent 内部记忆，含服务器路径与排查记录）和系统垃圾文件。

## 目录概览

| 目录 / 文件 | 内容 |
|---|---|
| `vocab_pipeline/` | 词库抓取、核对、合并管线（含各册参考表、教材图片） |
| `sentence_module/` | 句子模块前后端改动副本 |
| `audio_assets/`, `audio_fix/` | 官方录音切分与修复脚本、切片音频 |
| `drill/`, `stats_fix/`, `ui_fix/`, `words_fix/` | 各轮修复的代码副本与 SQL |
| `tools/` | 通用脚本 |
| `*.tsv` | 教材句子、考点、挖空题的人工核对底稿 |
| `*.sql` | 建表、补字段、修数据的一次性脚本 |
| `page_*.jpg` / `*_zoom*.png` | 课本扫描页与放大取证截图 |
| `HANDOFF-*.md` | 阶段性交接文档 |
| `U1_*`, `八上*`, `词库*` | 核验报告与设计说明 |

## 同步

```bash
./sync.sh                      # 自动 add + 时间戳 commit + pull --rebase + 推送所有远端
./sync.sh "补充 U3 挖空题"      # 自定义提交说明
```

`sync.sh` 会遍历所有已配置的远端（`origin` = GitHub，`gitee` = Gitee），任一可用即可。

## 音频取用优先级

1. 人教社官方录音 `pep.com.cn`
2. 国家中小学智慧教育平台 `basic.smartedu.cn`
3. 都没有时才用 TTS 合成（线上站已切换为 Edge TTS `en-GB-SoniaNeural`，语速 -5%）

## 内容录入约定

- 句子必须能在教材原句中找到，不接受「多来源一致」作为依据，只认课本扫描件/纸质教材。
- 挖空题答案必须唯一，优先挖介词、连词、固定搭配关键词。
- 保留教材英式拼写（`colourful` / `humour` / `practise`）。
