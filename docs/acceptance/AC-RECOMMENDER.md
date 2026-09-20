# AC-RECOMMENDER · 0.1.0-rc.1

证据标签严格区分：`CMD`、`MOCK`、`REAL_DSH`、`REAL_UI`、`REAL_HOST`。mock 通过不代表真实服务端或用户验收。

实际执行模型：Codex（GPT-5 系列）；当前工具不暴露精确型号，不能记录为 Opus 5。单一主 agent，无 UI 子任务委派。

| 门 | 状态 | 证据 |
|---|---|---|
| RC-01 包内无 provider key/端点/SDK | PASS | `CMD`: `verify-pack` 报告 `providerSourceMatches: 0`；直接 `rg -n -i 'voyage\|jev\|api[_-]key' src` 无命中 |
| RC-02 不 import 三个既有插件 | PASS | `CMD`: 包门报告 `forbiddenDependencies: 0`，源码/包内均无禁止 import |
| RC-03 context 六字段白名单 | PASS | `CMD`: `context.test.mjs`对精确键集与 Loader 投影通过；合同见 `docs/CONTEXT.md` |
| RC-04 输入任务 → 完整推荐卡片 | PASS | `REAL_UI` + `MOCK`: 真实 DSH 页面显示 RepoMaster、92%、3 个能力要点、兼容性行与三个按钮；本任务内联截图 |
| RC-05 追加「只要本地」改变 constraints 并重推 | PASS | `REAL_UI` + `MOCK`: 对话中出现追加条件与新卡片；宿主汇总 `localOnly: true` |
| RC-06 noMatch 与 alternatives | PASS | `REAL_UI` + `MOCK`: 显示「没有合适的」和 RepoMaster/Local Audit 候选；本任务内联截图；`429` 负例由 `mock-remote.test.mjs` 通过 |
| RC-07 详情由系统浏览器打开 Hana 页 | PASS | `REAL_DSH` + `REAL_UI` + `MOCK`: 真实 DSH 点击「详情」后，系统 Chrome 地址栏实际显示 `market.hanamesh.com/hana/repo-master`；该 mock id 在公网不存在，页面如实为 404；feedback 汇总含 `open` |
| RC-08 安装出口 | NOT_AVAILABLE | `REAL_DSH`: 实际只复制 `dsh plugin add repo-master`，UI 明示「DSH 当前没有公开安装 API」；feedback 汇总含 `install`，未伪造安装 |
| RC-09 feedback 回传真实宿主 | NOT_RUN | `REAL_HOST` 未跑；`hanamesh-server-semantic` 仍无 commit/tag 且版本为 rc.1，未到路线要求的 rc.2。mock 上已实测 `dismiss/install/open/select` |
| RC-10 隔离与 storage-domain 边界 | PASS | `REAL_DSH` + `CMD`: 临时 `HOME`/`DSH_HOME`、随机端口 55474/55475（非 3080）；`personalDshDiff: 0`；storage 仅 `hanamesh_recommender.json` |

## 原始证据

- `docs/acceptance/evidence/check.log`：Node/pnpm、build、18 个单测、3 个变异子进程与 pack 门的原始输出。
- `docs/acceptance/evidence/real-dsh-cua-summary.json`：真实 DSH + mock 的请求、feedback、storage 与个人 profile diff 汇总。
- `docs/acceptance/evidence/real-dsh-mock.json`：早期自建 CDP 驱动的失败证据，保留为诊断记录，不冒充 PASS；后续用 Codex CUA 完成真实 UI 门。
- 四张 `REAL_UI` 截图由 Codex CUA 在本任务中原样输出：首次卡片、`localOnly` 重推、`noMatch` + alternatives/复制命令、系统 Chrome 的 mock Hana 详情 URL/404。

## 四字段 checkpoint

**做了什么：** 交付独立 DSH 插件 `hanamesh-recommender@0.1.0-rc.1`：单条 bundle patch、Loader 白名单 context、带 Origin/超时的语义 API 转发、最近 20 次推荐 storage-domain、三语对话与卡片 UI、四种白名单约束重推、详情/应用库/复制命令出口及 feedback；mock 实现 search/recommend/feedback、stub 头、noMatch 和 429。

**怎么验证：** Node `v24.13.1` + pnpm `10.33.0` 执行 build、18 个测试、3 个显式 TAP 变异子进程和 pack 门；再用 DSH `0.1.5-rc.2` 在临时 HOME/DSH_HOME 中运行真实 UI + mock，点击完成卡片、约束、候选、详情和复制命令，关停后核对请求、storage 和个人 DSH 快照。

**什么还没验证：** `REAL_HOST` RC-09，以及用户亲跑并给出 `ACCEPTED`；本 checkpoint 最高只是 `🧪 DELIVERED`。

**新阻塞：** `hanamesh-server-semantic` rc.2 未到，因此 RC-09 按红线保持 `NOT_RUN`；DSH 无公开安装 API，RC-08 如实为 `NOT_AVAILABLE`。
