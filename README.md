# dsh-team-panel

DeepSeek Harness Web 客户端插件：把官方 experimental Agent Teams 的会话头部下拉面板移植为独立插件，数据改用 stock 投影，不依赖官方 team host 服务与 `spawn_teammate` 工具链。

## 功能

- **成员花名册**：入口挂在会话头部（`conversation.session.header.actions`），悬停/点击展开。首行是主会话（lead），其后是 `subagentCatalog` 投影里的本地子代理（continuable/one-shot；external 不显示）。
- **动态模型显示**：每个成员卡片常驻显示当前使用的模型（`modelSelection.next.model`，即 pending ?? lastUsed），不是悬停才出现。
- **状态**：运行中 / 未运行 / 准备中（unknown 模式子代理），叠加实时 running 状态。
- **打开成员会话**：点击成员卡片跳转（当前会话与不可跳转的成员置灰）。
- **任务板**：只读展示主会话 `todos` 投影（`todo_write` 工具维护的清单），三态状态点 + 展开收起。
- 无 host 端逻辑、无 RPC、无新工具；host 半边是空的 `apply()`，只为给 client bundle 一个加载锚点。

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
npm run build                        # host tsc + client typecheck 门禁 + tsdown bundle
```

产物：`lib/client.js`（浏览器闭包工厂 bundle，`window.__ModuleLoader__.load` 自注册）、`lib/host/index.js`（空 host 半边）。

类型检查的 `tsconfig.client.json` `paths` 指向 master 仓库 rc.1 tag（`2f97f60455`）提取的源码（`/tmp/rc1-types`），与运行时 0.2.2-rc.1 严格一致；提取树自带 dev 依赖噪音（shiki/clsx 等），`scripts/typecheck-client.mjs` 只对插件自身源码报错生效。

## 工作原理

- **客户端装载**：`package.json` 的 `dsh.client` 声明（`platform: web` + `inject` 列表）由 host 侧 `@deepseek-ai/dsh-client-modules` 扫描，自动组成 boot graph；浏览器 shell 通过 `window.__DSH_BOOT__` 拉取 `/plugins/dsh-team-panel/client.js` 并注册工厂。
- **平台外部依赖**：`react`、`react-dom`、`@deepseek-ai/dsh-client-ui-primitives` 等由 loader 的种子表在浏览器内提供，bundle 内是 `require(...)` 调用。
- **数据**：面板只读 stock 投影（`subagentCatalog`、`modelSelection`、`todos`），随会话事件流增量更新，无需轮询。
- **文案**：通过 `ctx.locale.register('team-panel', { zh, en })` 注册，slot 注册带 `locale: NS` 使 `t` 注入。

## 与官方 experimental 版的差异

| | 官方 experimental | 本插件 |
|---|---|---|
| 成员来源 | `agentTeam` 投影（需 host team 服务 + spawn_teammate 工具链） | `subagentCatalog` stock 投影 |
| 任务来源 | team task board（`team_task_*` 工具） | `todos` 投影（`todo_write`） |
| 模型显示 | 悬停成员卡片才出现 | 常驻显示 |
| host 依赖 | dsh-experimental-agent-team 全家桶 | 无 |

## 已知限制

- 只显示 lead 会话直接子代理（孙代不展开）。
- `todos` 是 `SessionProjectionSummaryExcluded`：只有打开过该会话（control/follow baseline 已拉取）才有值；主会话在当前视图打开时天然满足。
- rc.1 运行时专用；图标/Hook 与 rc.4 的 primitives 存在 API 差异，升级 dsh 前需对照更新。

## License

MIT
