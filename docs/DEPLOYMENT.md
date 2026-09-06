# cswork 独立部署

当前访问地址：[cswork](https://cswork.192.18.137.70.sslip.io)。2026-09-05 已部署 Monaco/OJ 应用 `0f5b46f361ba24df9b2551003e79904da59647f4`，真实生产队列执行、HTTPS、原老师登录及服务隔离验证通过，详见 [验收记录](VALIDATION.md)。老师账号为 `capsfly7@gmail.com`；凭据已交付所有者本地受保护文件，服务器的明文初始凭据副本已删除，本轮未重置账号。

主机 `ubuntu@192.18.137.70` 与 CSGrad 相同，但只新增以下 cswork 资源：

| 项目                 | 路径或名称                                                                            |
| -------------------- | ------------------------------------------------------------------------------------- |
| Linux 用户 / systemd | `cswork` / `cswork.service`                                                           |
| 应用                 | `/srv/cswork/releases/<commit>/`，`/srv/cswork/current` 指向当前版本                  |
| 独立 Node 运行时     | `/opt/cswork/runtime/node`，初始复制已安装的 Node 22.22.2                             |
| SQLite / 附件        | `/var/lib/cswork/cswork.sqlite` / `/var/lib/cswork/attachments/`                      |
| 私有视频             | `/srv/cswork/media/`，目录 cswork:www-data 2750，文件 0640                            |
| 配置                 | `/etc/cswork/cswork.env`，root:cswork 0640                                            |
| nginx                | `/etc/nginx/sites-available/cswork`，独立 vhost                                       |
| 应用监听             | `127.0.0.1:4317`，不直接暴露公网                                                      |
| 判题 worker          | `cswork-oj-worker.service`，`/srv/cswork/current/oj-worker/index.mjs`；无对外监听端口 |
| go-judge / Redis     | `cswork-oj-sandbox` / `cswork-oj-redis`；仅监听 `127.0.0.1:5050` / `127.0.0.1:6381`   |
| 判题凭据             | `/etc/cswork/oj.env`，root:root 0600，仅由 systemd 注入 worker                        |
| 判题运行时 / 数据卷  | `/srv/cswork/oj/` / `cswork-oj_redis-data`，独立于 CSGrad                             |
| 独立 TLS 证书        | `/etc/letsencrypt/live/cswork/`                                                       |
| 备份                 | `/var/lib/cswork/backups/`，每日运行，保留 14 天                                      |

CSGrad 的 `docusaurus` 进程、3000 端口、nginx 配置、证书和 Worker 后端都不修改。

## 首次与后续发布

从已提交源代码创建 git archive，上传服务器并在专用 build 目录解压。使用已安装的 Node 22.22.2 执行 `npm ci` 和 `npm run build`，原生 SQLite 依赖必须在 Linux ARM64 安装，不能上传 macOS 的 node_modules。

`npm run build` 同时生成应用和 `dist/standalone/oj-worker/`。BullMQ 6 使用的 Redis 驱动必须显式安装；当前为 `ioredis`，并由 [worker 打包脚本](../scripts/package-oj-worker.mjs) 复制到独立制品。只复制 BullMQ 而遗漏其可选 peer 会导致 worker 无法连接队列，本轮实际联调已覆盖此问题。

首次启用 OJ 先执行 `sudo bash deploy/oj/install.sh`，再发布应用。该安装器仅管理 cswork 专属运行时和随机凭据；详细配置、39 项真实运行检查及资源限制见 [判题运行时部署说明](oj-runtime.md)。已有容器与凭据应复用，不为每次应用发布重新生成。

在构建目录执行：

```sh
sudo bash deploy/install.sh <完整提交SHA> <独立域名> /home/ubuntu/.nvm/versions/node/v22.22.2/bin/node
sudo bash deploy/enable-https.sh <独立域名>
sudo /opt/cswork/runtime/node --env-file=/etc/cswork/cswork.env scripts/create-admin.mjs capsfly7@gmail.com 'Chunyu Sui'
```

初始化管理员只执行一次，拒绝覆盖已有账号。随机初始密码写入 `/var/lib/cswork/initial-login.txt`（0600），交付所有者后删除服务器上的明文副本。所有者通过密码入口登录；Google/GitHub 必须为 cswork 单独配置。

首次交付前可运行 `sudo /opt/cswork/runtime/node --env-file=/etc/cswork/cswork.env scripts/smoke-production.mjs`，它从上述临时凭据文件验证真实 HTTPS 登录、权限、CSRF、Cookie 作用域和退出，并清理自身会话。临时文件删除后不再重跑此脚本，不应为测试重置老师密码。

临时域名使用 `cswork.192.18.137.70.sslip.io`，它不在 csgrad.com 下。正式域名准备好后，将 A 记录指向该服务器，更新 nginx 的 cswork vhost、单独签发证书、修改 APP_URL 和 OAuth 回调，再重启 cswork。不得把新配置写到 CSGrad vhost。

安装器保留已有环境文件和 TLS 配置。第一次使用随机独立 BETTER_AUTH_SECRET；迁移前备份 SQLite，生成新版本目录后切换软链接，启动失败或健康检查超时回退原应用。nginx -t 失败时不会 reload 现有服务。

启用 OJ 后，Web 配置只保留 `OJ_ENABLED=true`，不向 Web 进程提供 `GO_JUDGE_TOKEN` 或 `REDIS_URL`。`cswork-oj-worker.service` 额外加载 root 保护的 `/etc/cswork/oj.env`，与应用共享 cswork 的 SQLite/outbox，使用独立 Redis 和默认队列 `cswork-judge-v1`。生产只运行一个 worker 服务，内部并发为 2；不要同时手工启动另一份生产 worker。

发布时安装器先停止旧 worker，再切换 `/srv/cswork/current`。除 Web 健康检查外，还要求新 worker 产生本次启动之后的健康心跳；任一检查失败，恢复旧应用软链接并在旧版本包含 worker 时重新启动它。回滚实现见 [应用安装器](../deploy/install.sh)，服务约束见 [worker unit](../deploy/cswork-oj-worker.service)。回滚应用不会撤销数据库迁移；恢复数据须使用迁移前备份。

隔离验收使用 `localhost:4318`、独立 staging SQLite、临时老师与学员、`cswork-oj-test-` 前缀队列。完整 [OJ E2E 脚本](../tests/oj-integration.mjs) 要求 `TEST_WORKER_ENTRY` 指向构建后的 worker，由脚本自行启动并清理；不得改用生产数据库或队列。实际测试证据见 [验收记录](VALIDATION.md)。

## 运维与恢复

```sh
sudo systemctl status cswork
sudo systemctl status cswork-oj-worker
sudo journalctl -u cswork -n 80 --no-pager
sudo journalctl -u cswork-oj-worker -n 80 --no-pager
sudo systemctl start cswork-backup.service
sudo systemctl list-timers cswork-backup.timer
```

数据库备份使用 SQLite 在线 backup API，按快照固定附件清单并保留文件后归档；视频以不可变对象复用。升级后的备份必须具有 `-complete.json` 完成标记，详见 [备份完整性与恢复](BACKUP-INTEGRITY.md)。备份都在同一主机，尚不等于异地灾备；需独立复制到受控备份存储。恢复数据库前停止 cswork 和 cswork-oj-worker，保留当前数据副本，再用同一时间戳的快照、附件归档及视频清单恢复并修正文件归属。版本切换不会自动回退已应用的数据库迁移。

Redis 使用独立 AOF 数据卷与 `noeviction`，应用以 SQLite/outbox 恢复未完成任务；不要执行 `docker compose down -v` 或清空生产 Redis。默认运行时验证不重启容器，AOF 重启验证只能在没有运行任务的维护窗口执行，见 [运行时维护与恢复](oj-runtime.md#组件与维护)。

Web 服务仅可写 `/var/lib/cswork` 与 `/srv/cswork/media`，内存上限 1GB、CPU 上限 150%；worker 单独限制为 512MiB、100% CPU，两者均不读取 CSGrad 的服务目录。执行器容器另有独立资源上限，见运行时说明。修改运行时、域名或数据路径后重新执行对应验证，不复制其他网站的密钥或账户数据。

## 视频服务

安装器设置 `MEDIA_PATH=/srv/cswork/media`、`MEDIA_X_ACCEL_PREFIX=/__cswork_media/`，并只在 cswork 实际代理 location 所在的 server 块插入独立媒体配置，保留原来的 HTTPS 证书和 HTTP 跳转。应用授权后发送内部重定向，Nginx 负责文件传输；直接访问 `/__cswork_media/` 应返回 404。不要把数据库父目录设为 www-data 可读。

本地与 staging 不设置 `MEDIA_X_ACCEL_PREFIX`，Node 流式处理 Range。真实视频导入完成后，验证生产匿名播放被拒绝、老师/授权学员 Range 返回 206、撤权后新请求被拒绝。导入和文件归属步骤见 [视频导入](IMPORT-GOMALL-VIDEOS.md)。
