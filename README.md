# 小说创作搭档 · dsh-novel-companion

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Made for DSH Desktop](https://img.shields.io/badge/DSH%20Desktop-plugin-4B6BFB)](#安装)

> 一个 DSH Desktop 插件：它会像编辑一样不断向你提问，把世界观、人物、情节打磨完整；每一章先写大纲给你改，你定稿后它再写正文。

**Novel Companion** is a third-party [DSH Desktop](https://github.com/deepseek-ai) plugin for long-form fiction writing. It interviews the author stage by stage (world → characters → plot), asks one question at a time, keeps a per-chapter outline that the author revises before any prose is written, and stores every project as one readable JSON document.

> 说明：这是第三方插件，不是 DSH 官方组件。「DSH」与 DeepSeek 是 DeepSeek 的商标。

---

## 功能

| 能力 | 说明 |
| --- | --- |
| **小说面板** | 左侧边栏书本图标 → 主区域；可自己改设定、大纲、正文，约 1.2 秒防抖自动保存；侧边栏显示每本的字数 |
| **`novel` 工具** | 对话里由模型读写同一份项目：列出/创建/切换阶段/写设定/存大纲/存正文/检索 |
| **7 个创作阶段** | 了解作者 → 世界观 → 人物 → 情节 → 分章大纲 → 写正文 → 收尾；未就绪时拒绝切阶段（可 `force` 跳过） |
| **6 个设定板块** | 内核、世界观、人物、情节、设定规则、文风；每块有 `draft/final` 状态和待问问题清单 |
| **每章三态** | `outline → writing → final`；大纲必须先由作者修改定稿，模型才写正文 |
| **一份数据** | 存储域 `novel_companion` → 表 `projects`（single JSON），面板和工具不是两套副本 |
| **读得全** | 模型 `get` 拿到 6 个板块全文 + 全部大纲 + 有预算的正文；每章标题后带 `chapterId`，写回大纲/正文只用照抄 id（或 `chapterIndex`） |
| **续写不丢文风** | `get` 默认展开上一章全文 + 最近 8 章首尾节选，写第 N 章时看得到前文笔触；`context=none/recent/all` 可调 |
| **检索** | `novel action=search query=…` 在设定、大纲、正文里找道具/伏笔/人名，返回命中章节 `chapterId` 与片段 |
| **冲突保护** | 面板保存带版本号（`rev`）：旧快照不会覆盖模型刚写的内容；半份文档（缺 title/blocks/chapters/stage）直接拒写 |
| **示例项目** | 「雾港钟楼」——面板里点「载入示例」即可看到完整的一本长什么样 |

面板底部按钮会把**写好的提问/指令**放进对话框草稿栏（不会冒充作者发消息），确认后按发送即可。

## 环境要求

- **DSH Desktop**（Web GUI 版本，Host 半 + Client 半；2026-10 在 DSH Desktop 上开发与验证）
- Node.js ≥ 20（跑自检脚本用；插件运行本身不需要）

## 安装

推荐让 DSH 的智能体代装（它会用插件管理器的 `install_bundle` 完成注册）：

> 「把 `dsh-novel-companion` 这个插件包安装并启用」

手动安装等价步骤：

1. 把本仓库放到一个固定路径（路径不要含空格），例如 `%USERPROFILE%\deepseek\dsh-novel-companion`；
2. 编辑当前 profile 的 `package.json`（DSH Desktop 默认是 `%USERPROFILE%\.dsh\profiles\desktop\package.json`），加两处：
   ```jsonc
   "dependencies": {
     "dsh-novel-companion": "link:C:/Users/<you>/deepseek/dsh-novel-companion"
   },
   "dsh": {
     "profile": {
       "bundles": [
         // …已有的 bundle…
         "dsh-novel-companion"
       ]
     }
   }
   ```
3. 在该 profile 目录执行 `pnpm install`，让 link 包落到 `node_modules`；
4. **完全退出 DSH Desktop**（托盘图标也要退，任务管理器里不能有残留进程）再打开——Host 半只在启动时加载一次；
5. 左侧边栏出现书本图标，点开即小说面板。

注意事项：

- 本插件以 **link（junction）** 方式安装进 profile，因此 Host 半只能 `import` `node:*`、自身相对文件或 `@deepseek-ai/*` 内置包；不要引入 `schemastery` 之类的 profile 私有依赖（会 `ERR_MODULE_NOT_FOUND`）。
- **不要用 PowerShell 直接改写含中文的源文件**（编码往返会损坏中文，项目开发中踩过这个坑，见 [开发纪要](docs/对话纪要.md)）。
- 改 `lib/index.js`（Host 半）必须完全重启 DSH Desktop 才生效；改 Client 半刷新页面即可。

## 自检

```bash
node scripts/verify.mjs
```

17 项检查，不启动应用、不改 profile：真实 Cordis Context 挂载、按模型服务商规则校验工具 schema、用极简 React 真实渲染面板、Remote 契约、模块解析、全链路模拟等。CI（`.github/workflows/verify.yml`）在 Windows + Ubuntu、Node 20/22 上跑同一套。

依赖本机 DSH Desktop 安装的几项在找不到安装时会打印 `SKIP …` 而不是误报失败；可用环境变量指定位置：

| 变量 | 默认值 | 含义 |
| --- | --- | --- |
| `DSH_HOME` | `~/.dsh` | DSH home 目录 |
| `DSH_PROFILE` | `desktop` | 承载本插件的 profile 名 |
| `DSH_APP_ROOT` | 常见安装路径 | DSH Desktop 的 `resources/app` 目录 |

单项检查：

```bash
node scripts/check-client-fresh.mjs   # client.js 是否落后于 tpl + state.js
node scripts/audit-css.mjs            # 主题 token / 字面颜色 / 背景色当文字色
node scripts/check-tool-schema.mjs    # novel 工具 JSON Schema
node scripts/check-panel-render.mjs   # 面板渲染 + 层级
node .selftest/prepare.mjs && node .selftest/run.mjs
```

`scripts/restart-and-check.ps1` 会重启 DSH Desktop 并把健康检查写进 `.restart-report.log`（路径自动探测，可 `-Exe` / `-LogDir` 覆盖）。

## 目录

```
.
├── package.json           # bundle 清单：exports / dsh.bundle / dsh.client
├── cordis.patch.yml       # bundle 补丁：插入 novel-companion 一行
├── icon.svg               # 侧边栏图标
├── locale/{zh,en}.json    # 插件页标题与简介
├── lib/
│   ├── index.js           # Host 半：存储域、Remote 服务、novel 工具、系统提示词
│   ├── demo.js            # 示例项目「雾港钟楼」
│   ├── state.js           # Host/Client 共享纯逻辑（校验、提示词、markdown）
│   ├── client.js.tpl      # Client 半唯一真源
│   └── client.js           # 由 tpl + state.js 生成，勿手改
├── scripts/               # 构建 + 自检/回归脚本
│   └── lib/env.mjs        # 定位仓库与 DSH 安装（环境变量可覆盖）
├── .github/workflows/     # CI：Windows + Ubuntu、Node 20/22 跑 verify.mjs
├── .selftest/             # Host 自检与共享校验回归
├── CHANGELOG.md           # 版本变更记录
└── docs/对话纪要.md        # 开发记录：19 轮对话、15 个真实 bug、框架踩坑
```

## 开发

- 改 Client 半：只改 `lib/client.js.tpl`，然后 `node scripts/build-client.mjs` 生成 `lib/client.js`；
- 改 Host 半：改 `lib/index.js`，重启 DSH Desktop 验证运行时；
- 每次提交前：`node scripts/verify.mjs` 必须通过；CI（GitHub Actions）会跑同一套；
- 版本记录见 [CHANGELOG.md](CHANGELOG.md)；
- 代码风格：纯 ESM、无构建工具、无第三方运行时依赖；注释与文档用中文/英文均可；
- 数据位置：`%DSH_HOME%\storages\novel_companion.json`（所有小说项目都在这一个文件里，可直接备份）。

更多细节（面板用法、数据格式、15 个已修 bug 的根因与回归、DSH 插件框架踩坑清单）见 **[使用说明.md](使用说明.md)** 和 **[docs/对话纪要.md](docs/对话纪要.md)**。

## 许可证

[MIT](LICENSE)
