# Changelog

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
