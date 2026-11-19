# dsh-team-panel

DeepSeek Harness Web 客户端插件：把官方 experimental Agent Teams 的会话头部下拉面板移植为独立插件，数据改用 stock 投影，不依赖官方 team host 服务与 `spawn_teammate` 工具链。

## 功能

- **成员花名册**：入口挂在会话头部（`conversation.session.header.actions`），悬停/点击展开。首行是主会话（lead），其后是 `subagentCatalog` 投影里的本地子代理（continuable/one-shot；external 不显示）。
- **动态模型显示**：每个成员卡片常驻显示当前使用的模型（`modelSelection.next.model`，即 pending ?? lastUsed），不是悬停才出现。
- **状态**：运行中 / 未运行 / 准备中（unknown 模式子代理），叠加实时 running 状态。运行/准备中以头像角落呼吸绿点表达，文字状态（悬停头像可见）不再占用卡片正文；卡片第二行只显示当前模型。
- **打开成员会话**：点击成员卡片跳转（当前会话与不可跳转的成员置灰）。
- **任务板**：只读展示主会话 `todos` 投影（`todo_write` 工具维护的清单），三态状态点 + 展开收起。
- **子会话模型选择**：打开 continuable 子会话后，在输入框底部使用与主会话相同的原生模型选择器（模型搜索、供应商分组、推理强度）。卡片只显示模型信息，不放切换按钮。子会话通过 `teamPanel/switchModel` 记录选择，下一步模型请求生效，不改变对话历史；已卸载的成员会显示错误，不会自动唤醒。主会话仍使用原生接口。
- **移除成员**：悬停成员卡片右上角出现 ✕，确认后调用 stock `workspace/archiveSession`（`stopActivity: true`）停止其运行并归档会话；父会话无法再唤醒它。会话历史保留，可在 设置 → 插件 → Team panel（Built-in plugin settings 卡片）或侧栏“仅显示已归档”里恢复（`workspace/unarchiveSession`）。花名册通过 `teamPanel/archivedChildren` RPC 过滤已归档子代理。
- Host 服务提供头像与模型选择 RPC，不替换 stock subagent 工具。模型目录可列出的路由不保证上游调用成功；切换成功仅表示选择已记录。

## 安装

```sh
cd ~/.dsh/profiles/web
pnpm add file:/home/xiwa/gitlab/dsh-team-panel
```

`dsh plugin add` 只写依赖，不写 patch 行；本包自带 `cordis.patch.yml`（`dsh.plugin --profile web add <path>` 会自动应用），或手工在 `~/.dsh/profiles/web/cordis.patch.yml` 顶部插入：

```yaml
- id: team-panel
  name: dsh-team-panel
```

重启 `dsh --profile web` 生效。

## 构建

```sh
npm install --no-save @types/react@19 @types/react-dom@19   # 一次性
python3 scripts/regen-rc1-types.py   # 重建 /tmp/rc1-types + tsconfig.client.json（需 master 仓库在 ../deepseek-harness）
npm run build                        # host tsc + 自有 client 源码类型检查 + tsdown bundle
npm test                             # 无真实 Host 调用的模型选择适配器测试
```

产物：`lib/client.js`（浏览器闭包工厂 bundle，`window.__ModuleLoader__.load` 自注册）、`lib/host/index.js`（头像与 live-agent 模型选择服务）。

类型检查的 `tsconfig.client.json` `paths` 指向 master 仓库 rc.1 tag（`2f97f60455`）提取的源码（`/tmp/rc1-types`），与运行时 0.2.2-rc.1 严格一致；提取树自带 dev 依赖噪音（shiki/clsx 等），`scripts/typecheck-client.mjs` 只对插件自身源码报错生效。

## 工作原理

- **客户端装载**：`package.json` 的 `dsh.client` 声明（`platform: web` + `inject` 列表）由 host 侧 `@deepseek-ai/dsh-client-modules` 扫描，自动组成 boot graph；浏览器 shell 通过 `window.__DSH_BOOT__` 拉取 `/plugins/dsh-team-panel/client.js` 并注册工厂。
- **平台外部依赖**：`react`、`react-dom`、`@deepseek-ai/dsh-client-ui-primitives` 等由 loader 的种子表在浏览器内提供，bundle 内是 `require(...)` 调用。
- **数据**：面板只读 stock 投影（`subagentCatalog`、`modelSelection`、`todos`），随会话事件流增量更新，无需轮询。
- **模型选择 UI**：从已安装的原生 `conversation.input.model` 注册取得组件，在子会话的 `conversation.input.right` 扩展位复用；不修改原生注册或主会话行为。子会话使用原生默认模型标签（含 badge），不转发第三方标签扩展。目录读取 Host 级 `session/modelCatalog`，无需保持父会话页面打开；选择只走 `teamPanel/switchModel`，不会通过原生 Agent-bound RPC 激活历史会话。
- **文案**：通过 `ctx.locale.register('team-panel', { zh, en })` 注册，slot 注册带 `locale: NS` 使 `t` 注入。

## 与官方 experimental 版的差异

| | 官方 experimental | 本插件 |
|---|---|---|
| 成员来源 | `agentTeam` 投影（需 host team 服务 + spawn_teammate 工具链） | `subagentCatalog` stock 投影 |
| 任务来源 | team task board（`team_task_*` 工具） | `todos` 投影（`todo_write`） |
| 模型显示 | 悬停成员卡片才出现 | 常驻显示 |
| host 依赖 | dsh-experimental-agent-team 全家桶 | 无 |

## 成员头像

成员卡片左侧的图标可以点击：

- **卡片上**：点击图标（未运行状态下显示）弹出图片选择菜单，选中立即生效；已分配时菜单里可“恢复默认图标”。运行中成员仍显示状态点（避免遮蔽 running 信号），停止后头像回归。
- **插件设置面板**：设置 → 插件 → Team panel，每个 lead/成员一行下拉框，预先配置好映射（不必点开 team 面板）。
- **添加图片**：把图片文件（png/jpg/jpeg/gif/webp/svg）放进本仓库 `data/assets/` 目录即可，无需改代码；映射存 `data/avatars.json`（sessionId → 文件名）。
- 图片通过 client-modules 包资产路由下发（`/plugins/dsh-team-panel/assets/<file>`），浏览器带 cookie 访问。

host 半边是一个 TypertRemoteService（`teamPanel` 命名空间，`list`/`assign` 两个方法），assign 校验文件存在 + 扩展名白名单 + `basename` 归一化，原子写盘。

## 已知限制

- 只显示 lead 会话直接子代理（孙代不展开）。
- `todos` 是 `SessionProjectionSummaryExcluded`：只有打开过该会话（control/follow baseline 已拉取）才有值；主会话在当前视图打开时天然满足。
- rc.1 运行时专用；图标/Hook 与 rc.4 的 primitives 存在 API 差异，升级 dsh 前需对照更新。

## License

MIT
