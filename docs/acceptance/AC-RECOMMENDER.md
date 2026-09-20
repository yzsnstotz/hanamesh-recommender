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

---

# AC-RECOMMENDER · 0.1.0-rc.2（本机回收 2026-09-21）

rc.1 → rc.2 的改动（全部由本机回收发现并修）：

1. **Origin 契约（阻断级）**：rc.1 宿主侧把 `Origin` 设为 DSH 自己的 `http://127.0.0.1:<port>`；真实 `hanamesh-server` 的 semantic 路由只接受 `allowedOrigins`（网站 + `https://api.hanamesh.com`），线上实测 400 `SEMANTIC_INPUT_INVALID`，即 rc.1 在真实宿主上一次都推不出来（mock 接受任意 Origin 所以没暴露）。rc.2 改为 `Origin = serverOrigin`（与 hanamesh-usage 上传一致），mock 同步复制真实宿主的 Origin 拒绝规则，变异 #3 改为「Origin 被换成外来回环」并由 `assert.doesNotReject` 以 ERR_ASSERTION 杀死。
2. `context.installed` 按 API-O5 schema 上限截到 100（大 profile 不再 400），新增单测。
3. `package.json` 去掉 `hanamesh.deliveryStatus` / `semanticMode`（DELIVERY_RULES §1.5 状态不进代码）；`@deepseek-ai/dsh-*` peer 改为 law `environment-matrix` 的已实测范围 `>=0.1.5-alpha.1 <0.2.0`、cordis `>=4.0.2 <5`。
4. 卡片 match% 圆环在真实 DSH 深色主题下数字不可读（截图证实）→ 改为 `--score` 驱动的圆环 + 内盘，`box-sizing:border-box`。
5. 新增 `scripts/real-dsh-ui-gate.mjs`：真实 Chrome（CDP）驱动真实 DSH 页面的证据脚本，落截图与请求汇总。

产物：`artifacts/hanamesh-recommender-0.1.0-rc.2.tgz` sha256 `98b93d0cd0765b828e6948cde67476b0cf4c85248e950889be3b4f696c167799`（`SHA256SUMS`）。

| 门 | 状态 | 证据（本机，`docs/acceptance/recovery-20260921/`） |
|---|---|---|
| RC-01 包内无 provider key/端点/SDK | PASS | `check-rc2.log`：`providerSourceMatches: 0` |
| RC-02 不 import 三个既有插件 | PASS | `check-rc2.log`：`forbiddenDependencies: 0` |
| RC-03 context 六字段白名单（+100 上限） | PASS | `check-rc2.log` 19/19，`context.test.mjs` |
| RC-04 输入任务 → 完整卡片 | PASS `REAL_DSH`+`REAL_UI`+`MOCK` / `REAL_HOST` | `mock-alpha1/03-first-recommendation.png`、`real-host-alpha1/03-first-recommendation.png`（固定内核 0.1.5-alpha.1、隔离 `HOME`/`DSH_HOME`、真实 Chrome） |
| RC-05 追加「只要本地」→ `localOnly` 重推 | PASS | 两个 `ui-gate-summary.json` 第二条 recommend 请求 `constraints.localOnly: true`，`04-constraint-localonly.png` |
| RC-06 noMatch + alternatives；429 文案 | PASS `MOCK` | `mock-alpha1/07-no-match.png`、`08-rate-limited.png`（`retry-after` 7s 显示） |
| RC-07 详情 → 系统浏览器 | PASS `REAL_DSH` | `open-details` 200，宿主调 `open`（本机默认浏览器实际弹出 `market.hanamesh.com/hana/<id>`），feedback `open` 落库 |
| RC-08 安装出口 | NOT_AVAILABLE（如实） | 复制 `dsh plugin add <id>` + 文案；`05-install-copied-command.png`；DSH 无公开安装 API |
| RC-09 feedback 回传真实宿主 | **PASS `REAL_HOST`** | 真实 `hanamesh-server 0.2.0-rc.6`（dist，一次性 `pgvector/pgvector:pg17` 库，26 条迁移，100 条真实形状条目经宿主 semantic 作业同步/嵌入）：`install / open / dismiss / select` 四行进入 `semantic.feedback_log`，`query_log.query_text` 全 NULL；`real-host-alpha1/ui-gate-summary.json`。线上 `api.hanamesh.com`（rc.6，stub）对同一 Origin 契约返回 200（目录重建中，暂 noMatch） |
| RC-10 隔离与 storage 边界 | PASS | 随机回环端口（非 3080）；storage 只有 `storages/hanamesh_recommender.json`；真实 `~/.dsh` 25,438 文件前后 sha 一致 `96275368…c4a0f` |
| 变异 | PASS 3/3（ERR_ASSERTION） | `check-rc2.log` |
| PLAT | macOS arm64 内核 0.1.5-alpha.1 PASS；内核 0.1.5-rc.2 = 交付方 rc.1 证据（rc.2 未重跑，NOT_RERUN）；其余 OS NOT_RUN（`ENV-MACHINES`） | — |

已知：`dshVersion` 取自 profile 配置而非探测（默认 `0.1.5-alpha.1`），在 rc.2 内核上装时应由 patch 写入实际值。

## 四字段 checkpoint（rc.2）

**做了什么：** 本机复跑 rc.1 全部自检并在真实 DSH（固定 alpha.1 内核）+ mock 上重走 RC-04–08；发现 rc.1 的 Origin 契约与真实宿主不兼容并修为 rc.2；对真实 `hanamesh-server rc.6` 宿主完成 RC-09；修 match% 圆环、installed 上限、peer 范围、状态词出代码。
**怎么验证：** Node 24.13.1 / pnpm 10.33.0；19/19 单测、3/3 变异、pack 门；真实 Chrome CDP 驱动真实 DSH，截图与请求汇总落盘；宿主库直查 feedback_log。
**什么还没验证：** 用户 ACCEPTED；rc.2 内核上的 rc.2 字节；线上目录重建完成后的真实候选（sync 中）；Windows/Linux/Intel Mac。
**新阻塞：** 无。
