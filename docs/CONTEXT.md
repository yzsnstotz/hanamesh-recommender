# Recommender context contract

`hanamesh-recommender` 只向配置的 HanaMesh Server 发送以下 context 字段：

| 字段 | 来源 | 值 |
|---|---|---|
| `runtime` | 插件宿主 | 固定 `local` |
| `os` | Node runtime | `macos` / `linux` / `windows` |
| `arch` | Node runtime | `process.arch` |
| `dshVersion` | bundle 配置的钉定宿主版本 | 字符串 |
| `installed` | Cordis Loader `entries()` 的当前投影 | 已加载插件 entry id 的排序去重列表 |
| `locale` | 当前浏览器 locale | `zh` / `en` / `ja` |

绝不上送：会话内容或历史、消息、工作区内容、文件名或文件路径、环境变量、凭据、任何 key、Loader 配置。用户主动输入的当前任务文本是 `/recommend` 的 `query`，不属于 context；本地推荐历史也不保存 query/context，只保存 request id、约束与推荐摘要，最多 20 条。

Loader 投影只能证明当前已加载条目，不能证明未加载包、历史安装或实时安装事件。DSH `0.1.5-alpha.1` 没有公开的插件安装写 API，因此安装出口只复制 `dsh plugin add <npm>`，状态为 `NOT_AVAILABLE`，不伪造安装成功。
