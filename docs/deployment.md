# 窝事部署

主分支推送后，GitHub Actions 类型检查、构建 Web 与 API，并通过 SSH 将该提交部署到 ECS。小程序由[独立仓库](https://github.com/wujianguo/jarvis-family-mini)管理。

## GitHub Actions secrets

- `DEPLOY_SSH_KEY`：仅限 CI 使用的 ECS SSH 私钥。
- `DEPLOY_KNOWN_HOSTS`：ECS 的 SSH 主机公钥行（通过可信渠道核对指纹后录入）。

## ECS 本地环境

`/home/ecs-user/woshi/.env` 仅 ECS 用户可读，不进入 git：`DATABASE_URL`、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL=https://share.libms.top/family/api/auth`、`WECHAT_MINI_APPID`、`WECHAT_MINI_SECRET`、`SMS_INGEST_TOKEN`、`SMS_AI_BASE_URL=https://token.libms.top/v1`、`SMS_AI_MODEL=deepseek-flash`、`SMS_AI_API_KEY`。PostgreSQL 限制在服务器回环地址。

管理员邮箱固定为 `lsjustin@yeah.net`。首次部署读取服务器本地的 `/home/ecs-user/woshi/admin-initial-password` 并自动初始化。管理员通过 SSH 在服务器上读取该文件登录，随后修改密码并删除文件。日后重设密码：在服务器本地临时设置 `ADMIN_INITIAL_PASSWORD`（至少 8 字符），运行 `cd /home/ecs-user/woshi && ADMIN_INITIAL_PASSWORD="$(cat admin-initial-password)" docker compose run --rm --no-deps -e ADMIN_INITIAL_PASSWORD api node /app/apps/api/dist/seed-admin.js`；密码不要输出到终端，完成后清除环境变量。

首次部署运行 `scripts/setup-server.sh` 安装 systemd 单元和 nginx 路由，它会先备份现有站点配置并执行 `nginx -t`。
