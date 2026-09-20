# hanamesh-recommender

> `0.1.0-rc.1` · `🧪 DELIVERED` · semantic mode: `stub` · real server gate: `NOT_RUN`

HanaMesh 的独立 DSH 推荐插件：Conversation + Recommendation Cards、白名单本地 context、追加约束重推、最近 20 次推荐摘要、安装命令/应用库/详情出口与 feedback。

## 隔离开发

```sh
export PATH=/Users/yzliu/.local/share/fnm/node-versions/v24.13.1/installation/bin:$PATH
export npm_config_cache=$(mktemp -d)
pnpm install --frozen-lockfile
pnpm check
node scripts/mock-server.mjs
```

把隔离 profile 里的 `serverOrigin` 指向 mock 输出的 loopback origin。mock 实现 `/v1/capabilities/search`、`/recommend`、`/feedback`，所有成功响应带 `x-hanamesh-semantic-mode: stub`；query 含 `no-match` 或 `429` 可触发两个负例。

安装按钮目前只复制命令，因为钉定 DSH 没有公开安装 API；应用类结果进入 `/hanamesh/library`，详情由宿主打开 `https://market.hanamesh.com/hana/<id>`。不依赖或 import 其他 HanaMesh 客户端插件。

验证状态见 `docs/acceptance/AC-RECOMMENDER.md`。本 rc 在隔离的真实 DSH `0.1.5-rc.2` 宿主上对 mock 完成卡片、约束重推、`noMatch`、详情和复制命令门；语义服务端 rc.2 未到，因此 `REAL_HOST` feedback 保持 `NOT_RUN`，不扩大声明。
