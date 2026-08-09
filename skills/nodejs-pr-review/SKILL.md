---
name: nodejs-pr-review
description: 审查 nodejs/node（或其他 GitHub 仓库）的 Pull Request，并生成面向初学者的 HTML 代码审查报告。适用于以下场景：(1) 用户要求审查 nodejs/node 最新或待合并的 PR；(2) 分析 PR 的 diff 并评估是否达到合并标准；(3) 向刚接触 Node.js core 的开发者解释一批 PR 做了什么；(4) 生成带图表的 HTML 审查报告。数据获取只读：绝不在 GitHub 上发表评论、批准、打标签或做任何写操作。
---

# Node.js PR 审查

## 工作流程

1. **准备工作目录。** 创建一个工作目录（例如 `pr-reviews/`）。如果 `exec_command` 报错 `bwrap: Unexpected capabilities...`，说明沙箱不可用，改用 `require_escalated` 并附简短说明。
2. **只读获取 PR 数据。**
   ```bash
   scripts/fetch_pr_data.sh --repo nodejs/node --count 10 --out data
   ```
   默认 API 地址为 `https://api.github.com`。在 Sprite 环境中可传 API 网关地址（`--api https://api.sprites.dev/v1/gateway/github/<conn-id>`）以避免限流。仅使用 GET 请求。
3. **编写 `reviews.json`。** 为每个 PR 编号写一条记录，包含大白话解释、关键改动、审查发现、结论和初学者笔记。字段结构、结论与严重度定义见 `references/review_guide.md`。
4. **逐个审查 PR。** 阅读 `data/pr_<N>.json`、`data/pr_<N>_files.json`（含每个文件的 patch）、`data/pr_<N>_reviews.json`、`data/pr_<N>_comments.json`、`data/pr_<N>_issue_comments.json` 和 `data/pr_<N>_checks.json`。如有本地 nodejs 源码，用其核对调用点；否则用 PR 的 `base.sha` 通过 API 拉取基线版本文件。按 `references/review_guide.md` 中的分类清单执行。
5. **生成 HTML 报告。**
   ```bash
   scripts/generate_report.js --data data --reviews reviews.json --out .
   ```
   生成 `index.html` 与 `pr-<N>.html`（内联 SVG 图表，无需联网），并把 `assets/style.css` 复制到 `out/assets/`。
6. **校验。** 打开 `index.html`，确认每个 `pr-<N>.html` 存在、内部链接可点、HTML 无未闭合标签；GitHub PR 地址和 `#NNNN` 引用必须渲染为可点击链接。

## 规则

- GitHub 访问只读（仅 GET）。绝不发表评论、创建 review、打标签或推送。
- “最新 PR”指 open 且按 `created` 倒序（与 GitHub `/pulls` 默认一致）。报告中应注明该假设。
- 结论使用：`approve`（可以合并）、`approve-with-nits`（可以合并，有提醒）、`discuss`（需讨论；草稿或重复提案用这个）、`needs-changes`（需修改）。
- 发现的严重度：`high`、`medium`、`low`、`nit`、`info`，每一条都要给具体建议。
- 每个 PR 页面面向 Node.js core 初学者：包含大白话解释、关键改动、文件、发现、CI 状态和简短小词典。
- 每条发现都要有证据（文件/行号/行为）。重构删代码时，必须对比基线版本语义后再下“等价”结论。
- 报告每个 PR 的 CI 状态（成功/失败/进行中/跳过），CI 红灯应影响结论。

## 资源

- `references/review_guide.md` — 分类审查清单（src-core / sqlite / deps / test-WPT）、常见回归模式、结论与严重度口径、`reviews.json` 结构。写发现前先读它。
- `scripts/fetch_pr_data.sh` — 只读 GitHub 数据抓取脚本。
- `scripts/generate_report.js` — HTML 报告生成器（内联 SVG 图表）。
- `assets/style.css` — 报告样式，复制到输出目录。
