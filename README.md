# hanamesh-recommender

npm 安装入口：`dsh plugin --profile desktop add --save-exact @hanamesh/recommender@0.1.1-rc.2`。插件 id 仍为 `hanamesh-recommender`；独立安装，不属于 HanaMesh 套件，DSH peer 仍为 0.1.5-alpha.1 线。

> `0.1.0-rc.3` · `🧪 DELIVERED`（本机 2026-09-22）· 推荐卡片三动作（详情 / 安装 / 开始用）改走 HanaMesh 市场（app-host）duck-typed 席位 `hanameshMarket`；席位缺失时可读降级。与 app-host rc.32 的真实联调 `NOT_RUN`；ACCEPTED 由用户给

HanaMesh 的独立 DSH 推荐插件：Conversation + Recommendation Cards、白名单本地 context、追加约束重推、最近 20 次推荐摘要、三动作出口（详情 / 安装 / 开始用）与 feedback。

## 隔离开发

```sh
export PATH=/Users/yzliu/.local/share/fnm/node-versions/v24.13.1/installation/bin:$PATH
export npm_config_cache=$(mktemp -d)
pnpm install --frozen-lockfile
pnpm check
node scripts/mock-server.mjs
```

把隔离 profile 里的 `serverOrigin` 指向 mock 输出的 loopback origin。宿主侧转发时 `Origin` 头 = `serverOrigin` 本身（与 hanamesh-usage 相同，`hanamesh-server` 的 `allowedOrigins` 只信任网站与自身 origin），mock 也按同一规则拒绝其它 Origin。mock 实现 `/v1/capabilities/search`、`/recommend`、`/feedback`，所有成功响应带 `x-hanamesh-semantic-mode: stub`；query 含 `no-match` 或 `429` 可触发两个负例。

## 三动作与 HanaMesh 市场席位

卡片的三个动作全部落到 HanaMesh 市场（app-host），**duck-typed，不 import app-host 包**：宿主侧用 `ctx.get('hanameshMarket')` **懒读**席位（本 cordis 没有 optional inject，把它写进 `inject` 会让本插件在官方 DSH 上根本不加载），逐个方法存在性判断后才调用。

| 动作 | 席位方法 | 席位缺失时 |
|---|---|---|
| 详情 | `open({itemId?,packageName?})` | 退回系统浏览器打开目录链接 `https://market.hanamesh.com/hana/<id>` |
| 安装 | `install({itemId?,packageName?})` | 503 `RECOMMENDER_MARKET_UNAVAILABLE`，UI 显示「请先安装 HanaMesh 市场（app-host）」并附上可复制的 `dsh plugin add <pkg>`，不伪造安装 |
| 开始用（invoke） | 已装应用 `openApp({appId,…})`；已装插件不调席位，只新建会话；未装先 `install` | 已装插件（Loader 投影可证）仍可新建会话；其余同上 |

`isInstalled(packageName)` 有就用，没有就退回 Loader 投影（只能证明**已加载**条目）。安装完成 / 需重启由席位的 `status` 如实透传，绝不说成「已启用」。已装插件的「开始用」由客户端 duck-typed 调壳自己的 `uiWorkspace.startSession()`（sidebar 用的同一个客户端服务）并留下一条 toast；拿不到就只留提示。不依赖或 import 其他 HanaMesh 客户端插件。

验证状态见 `docs/acceptance/AC-RECOMMENDER.md`。rc.2 已在隔离真实 DSH 上完成卡片、约束重推、`noMatch`、详情门，并对真实 `hanamesh-server 0.2.0-rc.6` 完成 feedback 的 `REAL_HOST`。rc.3 的席位联调要等 app-host rc.32 提供 `hanameshMarket`，在本机只能验到**席位缺失降级**那一路，联调如实记 `NOT_RUN`。

## Development Git supply

Version `0.1.1-rc.1` replaces development Devkit vendor files with the normal Git subdirectory caret range, using pnpm 10.33.0, and removes its unused public optional peer. Normal `npm pack` still runs the existing build lifecycle. Runtime source and public API remain unchanged from rc.5. See [the supply record](docs/DEVKIT_SUPPLY.md) for the source, supported package manager, authorization and purpose. Earlier runtime evidence above retains its original scope.
