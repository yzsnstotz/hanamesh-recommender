# Stage 3 learning

- DSH UI 验收必须同时隔离 `HOME`、`DSH_HOME`、用户数据目录和 npm cache；启动前后对个人 `~/.dsh` 做内容快照，本轮 diff 为 0。
- 宿主已公开的只读 Loader 投影适合生成 `installed` 白名单，但不是安装写 API；因此必须把「命令已复制」与「插件已安装」严格分开。
- 自建 CDP 驱动在 macOS 显示链路可以卡在 `Page.navigate`，即使 DSH listener、宿主 API 和 storage 已正常；不应把这些信号冒充 UI PASS。本轮保留了失败 JSON，并改用 Codex CUA 在真实 DSH 页面完成点击和截图。
- 验证追加条件时，不只看 UI 文案；还要在 mock 请求汇总中确认 `constraints.localOnly === true`。
- 服务端 rc.2 未到时，mock feedback 只能证明客户端链路，不得替代 `REAL_HOST`；RC-09 必须保持 `NOT_RUN`。
