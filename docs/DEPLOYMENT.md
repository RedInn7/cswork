# cswork 独立部署

当前访问地址：[cswork](https://cswork.192.18.137.70.sslip.io)。已在 2026-09-05 完成 HTTPS、登录、重启持久化及备份验证。初始老师账号为 `capsfly7@gmail.com`；凭据已交付所有者本地受保护文件，服务器的明文初始凭据副本已删除。

主机 `ubuntu@192.18.137.70` 与 CSGrad 相同，但只新增以下 cswork 资源：

| 项目                 | 路径或名称                                                           |
| -------------------- | -------------------------------------------------------------------- |
| Linux 用户 / systemd | `cswork` / `cswork.service`                                          |
| 应用                 | `/srv/cswork/releases/<commit>/`，`/srv/cswork/current` 指向当前版本 |
| 独立 Node 运行时     | `/opt/cswork/runtime/node`，初始复制已安装的 Node 22.22.2            |
| SQLite / 附件        | `/var/lib/cswork/cswork.sqlite` / `/var/lib/cswork/attachments/`     |
| 配置                 | `/etc/cswork/cswork.env`，root:cswork 0640                           |
| nginx                | `/etc/nginx/sites-available/cswork`，独立 vhost                      |
| 应用监听             | `127.0.0.1:4317`，不直接暴露公网                                     |
| 独立 TLS 证书        | `/etc/letsencrypt/live/cswork/`                                      |
| 备份                 | `/var/lib/cswork/backups/`，每日运行，保留 14 天                     |

CSGrad 的 `docusaurus` 进程、3000 端口、nginx 配置、证书和 Worker 后端都不修改。

## 首次与后续发布

从已提交源代码创建 git archive，上传服务器并在专用 build 目录解压。使用已安装的 Node 22.22.2 执行 `npm ci` 和 `npm run build`，原生 SQLite 依赖必须在 Linux ARM64 安装，不能上传 macOS 的 node_modules。

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

## 运维与恢复

```sh
sudo systemctl status cswork
sudo journalctl -u cswork -n 80 --no-pager
sudo systemctl start cswork-backup.service
sudo systemctl list-timers cswork-backup.timer
```

数据库备份使用 SQLite 在线 backup API，附件与快照分开归档。备份都在同一主机，尚不等于异地灾备；需独立复制到受控备份存储。恢复数据库前停止 cswork，保留当前数据副本，再用选定 SQLite 快照和对应附件归档恢复并修正文件归属。版本切换不会自动回退已应用的数据库迁移。

服务仅可写 `/var/lib/cswork`，内存上限 1GB、CPU 上限 150%；不读取 CSGrad 的服务目录。修改运行时、域名或数据路径后重新执行对应验证，不复制其他网站的密钥或账户数据。
