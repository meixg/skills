# 审查指南

## 目录

1. 审查目标与读者
2. `fetch_pr_data.sh` 生成的数据结构
3. `reviews.json` 结构
4. 结论口径
5. 发现严重度定义
6. 分类审查清单
7. nodejs/node PR 常见回归模式
8. 报告要求

## 1. 审查目标与读者

交付物是“每个 PR 的 code review”加“面向初学者的 HTML 报告”。把每个 PR 当作一次合并就绪度评估：正确性、回归风险、测试覆盖和 CI 状态。报告要能让刚接触 Node.js core 的开发者读懂，所以每个页面都需要大白话解释和小词典。

## 2. `fetch_pr_data.sh` 生成的数据结构

所有文件位于 `--out` 目录（默认 `data/`）：

- `pr_list.json` — PR 列表（number、title、state、created_at、head/base、user、draft）
- `pr_<N>.json` — PR 元数据，含 `base.sha`、`head.sha`、正文
- `pr_<N>_files.json` — 逐文件变更；每项含 `filename`、`status`、`additions`、`deletions` 和 `patch`（unified diff）
- `pr_<N>_reviews.json` / `pr_<N>_comments.json` — 已提交的 review 和行内评论
- `pr_<N>_issue_comments.json` — issue/PR 讨论（含 bot 的 CI 消息）
- `pr_<N>_commits.json` — 提交列表（多提交 PR 用它概括改动）
- `pr_<N>_checks.json` — CI check-runs，`conclusion` 取值：success/failure/skipped/null（进行中）

## 3. `reviews.json` 结构

```json
{
  "meta": { "repo": "nodejs/node", "fetched_at": "YYYY-MM-DD", "note": "..." },
  "reviews": {
    "65159": {
      "category": "src-core | sqlite | deps | test",
      "categoryLabel": "人类可读的分类名",
      "verdict": "approve | approve-with-nits | discuss | needs-changes",
      "verdictLabel": "简短的结论标签",
      "verdictNote": "一段话总结结论",
      "summaryZh": "技术摘要",
      "plainLanguage": "大白话解释",
      "whyItMatters": "这个 PR 为什么值得关注",
      "keyChanges": [{ "title": "...", "detail": "..." }],
      "findings": [{ "severity": "high|medium|low|nit|info", "title": "...", "detail": "...", "suggestion": "..." }],
      "ciNote": "CI 状态文字说明",
      "beginnerNotes": ["小词典条目 1", "..."]
    }
  }
}
```

## 4. 结论口径

- `approve` — 无阻断问题；机械性或低风险改动（测试同步、小版本依赖更新）。
- `approve-with-nits` — 可合并，但记录非阻断建议（文案、覆盖、需要盯着的 CI）。
- `discuss` — 方向未定：草稿、重复提案，或携带可疑上游代码的依赖更新。
- `needs-changes` — 存在具体 bug、回归、CI 红灯或不安全重构，必须先修。

## 5. 发现严重度定义

- `high` — 行为回归、崩溃、安全边界问题，或发布代码路径上的确定 bug。
- `medium` — 边界情况很可能出错，或风险较大但缺测试覆盖。
- `low` — 边界行为不一致、需要核实的 CI 失败、高风险改动缺测试。
- `nit` — 风格、措辞、错误信息润色。
- `info` — 正面确认、范围说明，或需要跟踪的关联（但不在本 PR 范围）问题。

## 6. 分类审查清单

### src-core（C++ / src/）

- 先读 PR 正文和提交，理解意图再看 diff。
- 核对被改 API/类的每个调用点：编译安全与行为（例如传给 `Array::New` 的数组长度必须是实际填充数量，而不是分配容量）。
- 对 `v8::Local<T>` 存储，确认句柄不会进入 `malloc` 内存；动态场景应使用 `v8::LocalVector`。
- 对比 V8 Fast API 路径与慢路径：边界输入（未知 scope、`ToString` 失败、空字符串）下返回值/异常行为必须一致。
- 对删除类别的重构（如权限类合并），diff 基线版本，确认 `Apply`/`Drop`/`is_granted` 语义被保留。
- 新增持久化字符串/模板时，检查快照路径（`IsolateData::Serialize`/`Deserialize`）。
- 记录格式/CI 问题（`lint-cpp`、`make format-cpp`）。

### sqlite（src/node_sqlite.*）

- `sqlite3_prepare_v2()` 对只有注释/空白的 SQL 会返回 `SQLITE_OK` 但 `sqlite3_stmt*` 为 NULL；使用语句前必须防护。
- 决定在哪里拒绝非法输入：prepare 阶段（避免缓存坏语句）还是执行阶段（改动最小）。同一 issue 出现多个修复 PR 时，指出重复。
- authorizer 回调不得修改触发它的连接；核对 RAII 守卫在所有退出路径都递减（异常安全），并覆盖全部入口：数据库方法、语句、迭代器、tag store。
- 错误码/文案要与现有约定一致（`ERR_INVALID_STATE`、`ERR_INVALID_ARG_VALUE`、`ERR_SQLITE_ERROR`）。
- `node:sqlite` 是 Stability 1.2，可直接改行为而无需 deprecation，但审查中要说明这一点。

### deps（deps/ 更新）

- 确认 vendored 版本号与版本头（如 `src/undici_version.h`）和构建集成（`node.gyp`）同步。
- 概括会影响到 Node.js 用户的上游变更（新选项、deprecation、重试预算、解析器修复）。
- 抽查会原样进入 Node.js 的可疑上游代码（如校验笔误、选项字段不一致）。下“阻断”结论前先与上游核实，但一定要标注。
- 关注共享库场景的 ABI/soname 变化，并建议在目标架构上跑依赖自身 testsuite。
- 机械性 bump 期望 CI 全绿；失败必须解释后才能合并。

### test / WPT

- WPT 同步会更新 `test/fixtures/wpt/versions.json` 和夹具文件；核对 WEB_FEATURES.yml 格式符合上游约定。
- 纯测试 PR 的 CI 失败通常是 flaky：要求重跑并与 main 对比。
- 新增的上游断言（如密钥长度检查）可能暴露真实实现 bug——注意 CI 是否通过。

## 7. nodejs/node PR 常见回归模式

- **部分填充缓冲区**：分配 `N` 个槽位只填 `M`（`M < N`），随后用缓冲区的长度创建数组。症状：多出空条目。修复：把长度设为 `M` 或显式传数量。
- **快/慢路径不一致**：V8 Fast API 回调在慢路径会抛异常的地方静默返回 `false`。
- **重构声称“等价”**：被删除的类/映射常有细微差别（默认状态、按 scope 的行为）。必须 diff 基线语义。
- **缓存污染**：无效对象被缓存复用（如 NULL sqlite 语句）——应在创建时修复，而非使用时。
- **RAII 顺序**：深度计数器在提前返回时没有递减；优先使用作用域守卫。
- **快照漂移**：新增持久化数据进了 `Serialize`，但 `Deserialize` 处理不当（空 `Local`）。

## 8. 报告要求

`scripts/generate_report.js` 生成：

- `index.html` — 结论环形图、各 PR 增删行、文件分布、CI 堆叠条、总览表、新手导读。
- `pr-<N>.html` — 头部（标题、徽章、可点击的 GitHub 链接）、大白话解释、摘要、关键改动、文件表与条形图、带严重度徽章的发现、结论、CI 状态、小词典。

图表为内联 SVG，无外部资源。GitHub 链接和 `#NNNN` 引用必须可点击（`target="_blank" rel="noopener"`）。页面要注明：审查为本地只读分析，不替代 maintainer 正式 review，并记录数据快照时间。
