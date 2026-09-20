# hanamesh-recommender boundaries

- 这是独立 DSH 插件，只有一条 `dsh.bundle.patch`。
- 不 import `hanamesh-core`、`hanamesh-usage`、`@hanamesh/dsh-app-host`；应用库只走 `/hanamesh/library` 深链。
- 不放 provider SDK、provider endpoint 或 provider credential；只调用配置的 HanaMesh Server `/v1/capabilities/*`。
- context 必须与 `docs/CONTEXT.md` 六字段完全一致。不要上送会话、文件路径、环境变量或 key。
- 无公开安装 API 时只复制命令并保留 `NOT_AVAILABLE`，不得伪造安装。
- 真实宿主只用临时 `HOME` / `DSH_HOME` / 端口；禁止触碰 `~/.dsh`、3080 和研究 runtime。
- `ACCEPTED` 只能由用户给；本仓 agent 最高写 `DELIVERED`。
