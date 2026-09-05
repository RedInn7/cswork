# cswork

独立的 SDE 学习与辅导平台：17 份 GoMall 课件、笔记与进度、算法练习、工程作业评审、私密工单和附件、教师待处理工作台、课程授权与版本通知。

cswork 与 CSGrad 只共用服务器硬件，不共享品牌、账号、数据库、接口或应用进程。本地平台代码位于 `cswork/platform`；同目录已有的 MediaCMS 项目与数据没有被覆盖。

## 本地运行

需要 Node 22.13+，生产使用 Node 22。判题在独立沙箱中执行，不在 Web 进程中执行学生代码。

```sh
npm ci
node scripts/setup-local.mjs
npm run admin:create -- teacher@cswork.test
npm run dev -- --host 127.0.0.1 --port 4317
```

访问 `http://localhost:4317/`。老师的随机初始密码写入仅本机用户可读的 `.local/owner-login.txt`，通过登录窗口的密码入口登录。初始化不会重置已有用户或覆盖凭据文件。

```sh
npm run typecheck
npm run test:oj
npm run build
HOST=127.0.0.1 PORT=4317 npm start
```

`npm start` 启动正式 standalone Node 服务。数据位于 `DATABASE_PATH` 和 `ATTACHMENTS_PATH`，均在构建输出之外。SQLite 使用 WAL、外键和原子批事务，附件通过权限检查后下载，不暴露静态目录。

## 验证

在独立测试数据库初始化后运行正式服务，再运行 `npm run test:integration`。测试使用 `.env` 中第一个管理员邮箱创建临时老师，因此不要对已有真实管理员或生产数据库运行；结束时删除测试账号、工单与附件。详见 [验收记录](docs/VALIDATION.md)。

## 服务器发布

生产由 nginx → `127.0.0.1:4317` → cswork systemd 服务提供。使用独立 Linux 用户、运行时副本、版本目录、数据目录和 TLS 证书，所有服务端变量位于 `/etc/cswork/cswork.env`。操作步骤、备份和回滚见 [部署说明](docs/DEPLOYMENT.md)。

旧 Sites 地址仅为历史私有原型；当前源码已经迁移到正式 Node 部署，移除了 Sites 身份头信任与 Cloudflare D1/R2 运行依赖。

## 内容与服务接入

`node scripts/import-course.mjs /path/to/gomall` 导入课件源文件。首次初始化数据库时创建课程；后续线上版本通过教师工作台发布，不会因重新构建覆盖现有课件。真实视频尚未导入时明确显示待发布。Go 工程实验在 Gomall 的 `exercises/` 中，学生交 GitHub PR 评审；算法题单独建模。

- **账号**：Better Auth。服务器 CLI 初始化老师；密码开放登录但关闭公开密码注册。Google、GitHub 和邮箱验证码配置完成后支持新学员注册；只有已验证邮箱且命中服务器白名单的用户才能成为老师。
- **第三方登录**：配置 `GOOGLE_CLIENT_ID/SECRET`、`GITHUB_CLIENT_ID/SECRET`；回调地址为正式域名下 `/api/auth/callback/google`、`/api/auth/callback/github`。为 cswork 单独创建 OAuth 应用，不复用 CSGrad 的身份后端。
- **验证码**：配置 `RESEND_API_KEY`、已验证发件域名的 `MAIL_FROM`；有效期 5 分钟，最多 5 次尝试。
- **算法判题**：Monaco 编辑器、BullMQ 持久化队列、独立 go-judge 1.12.3 沙箱，支持 C++20、Python、Java 和 Go。教师可管理测试点、保存草稿并发布不可变版本；提交支持逐点结果、取消与自动重试。部署见 [OJ 运行时](docs/oj-runtime.md) 和 [判题开发说明](docs/OJ.md)。
- **视频**：独立 Cloudflare Stream 配置 `STREAM_ACCOUNT_ID`、`STREAM_API_TOKEN`，老师发布时填写 UID 并强制签名播放。它是可选视频提供商，应用和数据仍在自有服务器。撤权后已有视频令牌最长保留 1 小时。
- **收费**：Stripe Checkout，配置 `STRIPE_SECRET_KEY`、`STRIPE_PRICE_GOMALL`、`STRIPE_WEBHOOK_SECRET`。Webhook `/api/stripe/webhook` 订阅 `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`charge.refunded`。正式收款前必须在测试环境验收成功/取消、100% 优惠、重复/乱序事件、全额和部分退款。

没有凭据的服务会明确提示暂不可用。站内通知不会自动向学员发送外部邮件。正式开放注册和收费前还需确定独立域名、课程定价、退款政策并完成上述联调。
