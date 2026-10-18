# Changelog

## 1.1.0

依据第二轮审查报告《dsh-novel-companion 审查报告》，修完 **P0（对话闭环）**、落地高价值 P1，并补上工程收尾。

### 对话闭环（P0）

- **模型终于能看到 `chapterId`**：`get`、`outline`、`appendChapter` 交给模型的每章标题后都带
  `chapterId=…`。此前所有渲染文本都不含 id，而 `outline` / `chapter` 又只做严格 id 匹配，
  于是「模型写回正文」这条核心链路实际是断的。现在标题行同时提示可以改用 `chapterIndex`。
- **`chapter` / `outline` / `get` 接受 `chapterIndex`（序号）**，`chapterId` 也容错接受纯数字
  字符串（`"3"`），并在找不到时报出可用章节的「序号:id(标题)」清单。
- **面板交接文案带上 id**：「写大纲 / 写正文」复制到草稿栏的提示现在写明 `projectId`、
  `chapterId`（和 `chapterIndex`），并要求模型写完用 `novel action=chapter` 直接写回项目，
  不再让作者手动粘贴正文。
- **`save` 拒绝半份文档**：写路径先校验 `title / blocks / chapters / stage`，缺字段直接报
  `缺少必需字段 …（疑似半份文档），已拒绝写入`，不再被 `normalizeProject` 的兜底静默补成
  「未命名小说 / 0 章」而清空整本。读路径仍会修复旧数据。
- **`appendChapter` 幂等**：同一本书 + 同标题 + 同大纲在 5 秒内重复调用（agent 重试语义）
  返回已有章节并标注 `reused`，不再多出一章同名章节。
- **半份文档提示**：`get` / 提示词板块 / `list` 对「默认书名 + 0 章 + 仍有设定内容 + 创建于
  今天之前」的项目给出「疑似曾被半份文档覆盖」的警告，不再把坏数据当正常项目。

### 长篇承载力（P1）

- **新增 `search` 动作**：`novel action=search query="铜钥匙"` 在设定、章节标题、大纲、正文里
  检索，返回命中位置、次数、片段和 `chapterId`——「这个道具上次在哪章出现」不用再逐章 `get`。
- **正文上下文策略可选**：`get` 新增 `context=prev|recent|all|none`。默认 `prev` 展开上一章
  全文、最近最多 8 章各取首尾 300 字节选，并保留第 1 章的节选（开篇定调）；`recent` 是旧行为，
  `all` 全展开，`none` 只给字数。30 章 9 万字实测：`get` 从 7.7k tokens 变为约 10k tokens，
  换取写第 N 章时能看到前文实际文风；觉得大可用 `context=none|recent`。
- **面板显示全书字数**：侧边栏项目行显示 `… · N 章 · X 字`，`list` 索引带上 `characters`。

### 阶段与工程（P2）

- **`stage` 未就绪时拒绝**：不再出现「阶段已切到已完结、返回里却写着未就绪」的自相矛盾；
  确实要跳过就传 `force=true`，结果会带 `readiness` 警告。
- **`package.json` 补 `peerDependencies`**：声明 `@deepseek-ai/dsh` 版本范围，DSH 的兼容性
  检查从此有依据（此前没有声明，等于永远「兼容」）。
- 文档收尾：`cordis.patch.yml` 顶部注释不再提已删除的 Composer 浮条；README / 使用说明同步
  新的 `search`、`context`、`force`、`chapterIndex` 用法。
- 回归断言补进 `scripts/simulate-tool.mjs`、`scripts/simulate-panel.mjs`、`.selftest/run.mjs`
  与 `scripts/check-tool-schema.mjs`；`check-host-invariants.mjs` 增加半份文档守卫与阶段
  gate 的静态检查。

## 1.0.2

- 去掉对话输入框上方的「小说 · 发设定 / 写正文」浮条：它出现在每一个会话里，不管作者有没有在
  写小说，还和面板里已有的按钮重复。小说只在「小说」面板里出现，面板里有同样的发设定 / 写正文
  入口；`check-panel-render.mjs` 改为断言不再注册 `conversation.input.dock`。

## 1.0.1

测试报告《dsh-novel-companion 测试报告与改进方案》里的 P0/P1 修复，加上路线图里的工程加固。

### 读写契约（P0）

- `novel action=get` 现在把 6 个设定板块全文、全部章节大纲、以及有预算的正文交给模型；
  新增 `chapterId` 参数用于按章读取完整正文。此前只返回 109 字的目录，模型实际上拿不到设定。
- 面板保存加了乐观锁（`rev`）：面板手里的旧快照不再静默覆盖模型刚写入的内容，冲突时自动
  重新拉取并提示；`刷新` 按钮同时刷新文档和列表。
- 工具执行失败不再渲染成「小说项目已更新」：失败返回 `ok: false` 并显示「小说项目操作失败：…」。

### 数据安全（P1）

- 自动保存的防抖改为每次编辑都重排计时器；保存成功后吸收新的 `rev`，避免下一次保存被误判为旧副本。
- 达到 500 章上限时 `appendChapter` 显式报错，不再静默丢章。
- 单字段超过 20 万字时拒写并提示拆章，不再静默截断。
- `list()` 只返回索引（无正文），Composer 浮条先 `list` 再 `get`；实测同一场景负载下降 83%。
- `readiness()` 不再是死代码：`stage` 动作返回就绪度，未就绪时在工具结果与面板提示。
- `outline` 动作接受 `status=outline`，章节三态一致。
- 「载入示例」按标题幂等，重复点击不再产生重复项目。
- 修复 i18n 重复键（「返回对话」曾显示为「上一步」），并把 11 处硬编码中文换成 `t()`。

### 工程与发布

- 新增 `scripts/check-client-fresh.mjs` 并接入 `scripts/verify.mjs`：`lib/client.js` 落后于
  `state.js` / `client.js.tpl` 时直接失败，不再被「重新生成」步骤掩盖。
- 新增 GitHub Actions（`.github/workflows/verify.yml`），在 Windows + Ubuntu、Node 20/22 上跑
  `node scripts/verify.mjs`。
- `package.json`：去掉与「可安装插件」矛盾的 `private: true`，补 `engines.node >= 20` 与
  `verify` / `test` / `build:client` 脚本。
- 面板章节状态条支持「大纲 / 写作中 / 已定稿」三态；`addChapter` 不再在 `setState` 的 updater
  里产生副作用（React 18 StrictMode 下可能产生两个 id）。
- 回归断言补进 `scripts/simulate-tool.mjs` 与 `scripts/simulate-panel.mjs`（共 7 个新检查点）。

## 1.0.0

首个版本：Host 半（存储 + `novels` Remote + `novel` 工具 + 提示词板块）与 Client 半（侧边栏
「小说」面板 + Composer 交接条）。
