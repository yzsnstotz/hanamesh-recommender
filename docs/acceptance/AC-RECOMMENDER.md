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

---

# AC-RECOMMENDER · 0.1.0-rc.3（T5 · HanaMesh 市场席位，2026-09-22）

rc.2 → rc.3 只改一件事：**推荐卡片的三个动作全部落到 HanaMesh 市场（app-host）**，duck-typed 席位 `hanameshMarket`，不 import app-host 包（设计定案 §4、实施计划 T5）。

## 席位契约与降级（最终形状）

宿主侧 `src/dsh.js` 用 `ctx.get('hanameshMarket')` **懒读**席位。**没有写进 `inject`**：本仓钉定的 cordis 4.0.2 只有「全部必需」一种 inject（`Inject` 类型 = 数组或 name→intercept 映射，没有 `optional`），写进去会让本插件在没装 app-host 的官方 DSH 上根本不加载——而契约要求的正是那台机器上要降级可用。`ctx.get` 是 cordis 自己给的「不带 inject 要求的读」，`ctx.hanameshMarket` 直读会抛 `cannot get property "hanameshMarket" without inject`，因此 resolver 外面还包了 try/catch。懒读同时换来：app-host 后装也能被下一次请求看见，无需重载本插件（`dsh.test.mjs` 有此用例）。

| 动作 | 宿主路由 | 席位调用 | 席位缺失 |
|---|---|---|---|
| 详情 | `POST /api/hanamesh/recommender/open-details` | `open({itemId?,packageName?})` | 退回 `openSystemBrowser('https://market.hanamesh.com/hana/<id>')`，响应 `via:'browser'` |
| 安装 | `POST /api/hanamesh/recommender/install` | `install({itemId?,packageName?})` | 503 `RECOMMENDER_MARKET_UNAVAILABLE`；UI 显示「请先安装 HanaMesh 市场（app-host）」+ 复制 `dsh plugin add <pkg>`，不伪造安装 |
| 开始用（invoke） | `POST /api/hanamesh/recommender/invoke` | 已装应用 → `openApp({appId,…})`；已装插件 → 不调席位，客户端 `uiWorkspace.startSession()` + toast；未装 → `install(...)` | 已装插件（Loader 投影可证）照常新建会话；其余 503 + 同一条可读提示 |

- 每个方法都**先判存在再调**（`market.has(name)` / `methods()`），只实现一部分的席位按方法粒度降级（`RECOMMENDER_MARKET_ACTION_UNAVAILABLE`）。方法调用 `bind(seat)` 保留 receiver（DELIVERY_RULES 坑 #7 的同类）。席位自己抛错一律收敛成 `RECOMMENDER_MARKET_FAILED` 502，不把席位的内部消息/路径透给浏览器。
- 已装判断：`isInstalled(packageName)` 有就以它为准（`source:'market'`）；没有该方法就退回 Loader 投影（`source:'loader'`，只能证明**已加载**条目，见 `docs/CONTEXT.md`）。
- 安装结果按席位给的 `status` 如实透传：`install-started` / `restart-required` 两种可读文案，**绝不说成「已启用」**。
- 客户端 bundle 不 `ctx.get` 任何**宿主**服务（DELIVERY_RULES §1.6）：三动作全部经本包宿主侧路由转发。客户端唯一的 `ctx.get` 是**客户端**服务 `uiWorkspace`（`@deepseek-ai/dsh-client-ui-sidebar` 自己就这么拿它的 `startSession`），同样 duck-typed，拿不到就只留提示不新建会话。

## 门

| 门 | 状态 | 证据（`docs/acceptance/rc3-20260922/`） |
|---|---|---|
| RC-01 包内无 provider key/端点/SDK | PASS `CMD` | `check-rc3.log`：`providerSourceMatches: 0` |
| RC-02 不 import 三个既有插件（含 app-host） | PASS `CMD` | `check-rc3.log`：`forbiddenDependencies: 0`；`verify-pack` 的禁止 import 扫描覆盖新增 `src/market.js` |
| RC-03 context 六字段白名单（+100 上限） | PASS `CMD` | `check-rc3.log` 34/34；席位只多传卡片自身派生的 `{itemId,packageName,appId}`，context 未变 |
| RC-04 输入任务 → 完整卡片 | PASS `REAL_DSH`+`REAL_UI`+`MOCK` | `mock-alpha1/03-first-recommendation.png` |
| RC-05 追加「只要本地」→ `localOnly` 重推 | PASS | `mock-alpha1/ui-gate-summary.json`、`04-constraint-localonly.png` |
| RC-06 noMatch + alternatives；429 文案 | PASS `MOCK` | `mock-alpha1/07-no-match.png`、`08-rate-limited.png` |
| RC-07 详情 → 席位 `open`，缺席位退回目录链接 | PASS `CMD` + PASS `REAL_DSH`（降级路） | `routes.test.mjs` 两路都断言；真实门无 app-host，`open-details` 200 走 `via:'browser'`，feedback `open` 落库（`mock-alpha1/ui-gate-summary.json`） |
| RC-08 安装 → 席位 `install` | PASS `CMD`（席位替身） / PASS `REAL_DSH`（降级路） | `routes.test.mjs`、`client-ui.test.mjs`；真实门 `install` 503 `RECOMMENDER_MARKET_UNAVAILABLE`，UI 显示「Install the HanaMesh market (app-host) first. / Install command (copied): dsh plugin add repo-master」，`05-install-market-or-degraded.png` |
| RC-09 feedback 回传真实宿主 | PASS（rc.2 沿用，rc.3 未改该路径） | rc.2 段 `real-host-alpha1/ui-gate-summary.json` |
| RC-10 隔离与 storage 边界 | PASS `REAL_DSH` | `real-dsh-host.json`：隔离 `HOME`/`DSH_HOME` 在 `/private/tmp/hm-t5rec-*`，回环随机端口 56915/56916（非 3080），`personalDshDiff: 0`，storage 仅 `hanamesh_recommender.json`（`onlyOwn: true`），结束后 `pgrep -f /private/tmp/hm-t5rec-` 为空、scratch 已删 |
| **RC-11 invoke 三态 + 席位缺失降级** | **PASS `CMD`（三态，席位替身）+ PASS `REAL_DSH`（缺席位降级）** | `routes.test.mjs` 的三条 RC-11 + 降级用例、`client-ui.test.mjs` 的三态文案与 toast、`market.test.mjs` 四条 duck-typing 用例；真实门 `09-invoke-start-using.png` 显示四个按钮 `Start using / Install & use / Details / Other choices`，`invoke` 503 后给同一条可读提示，未伪造启用 |
| 变异 | PASS 6/6（ERR_ASSERTION） | `check-rc3.log`，新增 3 条全在席位路径上 |
| PLAT | macOS arm64 / DSH 0.1.5-alpha.1（`hanamesh-dsh-runtime` 钉定产物）PASS；其余格子 NOT_RUN（`ENV-MACHINES`） | — |

## 没跑 / 没验证

- **席位真实联调 `NOT_RUN`**：`@hanamesh/dsh-app-host` 要到 rc.32 才 `provide('hanameshMarket')`，本机没有能提供该席位的产物，因此真实 DSH 上只能验到**席位缺失**那一路；`open/install/isInstalled/openApp` 四个方法的真实形状由替身覆盖，联调由派发 session 在 app-host rc.32 到位后跑。
- 用户 `ACCEPTED`。
- Windows / Linux / Intel Mac；DSH 0.1.5-rc.2 内核上的 rc.3 字节。

## 四字段 checkpoint（rc.3）

**做了什么：** 新增 `src/market.js`（duck-typed `hanameshMarket` 桥）、两条宿主路由 `install` / `invoke`，`open-details` 改为席位优先、目录链接兜底；卡片加「开始用」按钮并把三动作接到路由；已装插件交给壳的 `uiWorkspace.startSession()` 并留 toast；三语文案补 7 条。
**怎么验证：** Node 24.13.1 / pnpm 10.33.0；34/34 单测（新增 12 条，含 RC-11 三态与降级）、6/6 变异（新增 3 条全在席位路径）、pack 门；把 rc.3 tgz `dsh plugin add` 进隔离 `/private/tmp/hm-t5rec-*` 的全新 `web` profile（钉定 DSH 0.1.5-alpha.1，来自 `hanamesh-dsh-runtime` 产物），真实 Chrome 经 CDP 走完卡片 / 追加约束 / 三动作 / 候选 / noMatch / 429。

**顺带修的门脚本（不改插件行为）：** `serve-real-dsh-mock.mjs` 原先写死桌面壳里的 DSH 0.1.5-rc.2 与 `--skip-auth`——alpha.1 内核没有这个 flag，且需要它 stdout 上打印的一次性带 token URL 才能进 UI。现在内核路径默认 `hanamesh-dsh-runtime` 产物（`HM_DSH_BIN` 可换），scratch 根与前缀、readiness 超时可配，`--skip-auth` 仅在 `HM_SKIP_AUTH=1` 时加，token URL 自动捕获；写进证据时 token 已打码。
**什么还没验证：** app-host rc.32 到位后的席位真实联调；用户 ACCEPTED。
**新阻塞：** 无（联调依赖是排期，不是阻塞）。
