# SDE Academy

一个把课程、算法练习和私密辅导连起来的 SDE 学习平台。基于 React/Vinext、Cloudflare Workers/D1、Better Auth、CodeMirror 和 Video.js。判题复用独立 Judge0，收费使用 Stripe Checkout。

## 本地运行

需要 Node >=22.13、npm。代码执行沙箱不在本机启动。

```sh
npm ci
node scripts/setup-local.mjs
npm run dev -- --host 127.0.0.1 --port 4317
```

访问 `http://localhost:4317/`。点击“登录 / 注册 → 进入站点所有者预览”，本地 Sites 插件只在 localhost 注入 `seedy@sites.test` 测试身份。该身份在本地环境文件中是老师，可直接体验课程、笔记、工单、作业、授权和版本发布。该测试身份不会自动成为生产管理员。

第一次初始化后不要重新手动执行初始 SQL；使用 migrations apply 做增量迁移。`scripts/setup-local.mjs` 只创建缺失的本地环境文件，不会改动已有凭据。

## 验证

```sh
npm run typecheck
npm run test:integration # 需要上面的本地服务，隔离测试学员并在结束时清理
npm run build
```

集成测试实际调用 HTTP API，覆盖匿名访问、已验证邮箱授权、跨学员数据隔离、私密工单及附件、老师回复、作业评审、课程版本发布与重复版本冲突、CSRF、搜索、撤权与外部服务不可用场景。它不冒充 OAuth 提供商、支付平台或远程沙箱验收。测试账号和业务数据自动清理；上传的测试文件保留在本地 R2 模拟器中，不进入线上存储。

## 内容维护

```sh
node scripts/import-course.mjs /path/to/gomall
```

只导入讲师拥有的 17 份课件。首次访问时在 D1 中创建课程；已有线上课件不随源码重新导入被覆盖，新版本由教师工作台发布。视频不存在时如实显示待发布，禁止使用无关演示视频替代。

原始 Gomall 工程实验位于教学仓库 `exercises/`，有题面、学生骨架和公开测试；学生在自己的 GitHub 仓库完成后交 PR 评审。平台原创算法题与工程实验分别建模。

## 生产接入

复制 `.env.example` 中的键到部署平台的环境配置，敏感值用 Secret。`.dev.vars`、`.env*` 不得提交。

1. `APP_URL` 使用正式 HTTPS origin，`BETTER_AUTH_SECRET` 为独立生成的至少 32 字符随机值，`ADMIN_EMAILS` 为经过验证的老师邮箱白名单。
2. Google/GitHub OAuth 回调分别为 `/api/auth/callback/google` 和 `/api/auth/callback/github`。GitHub 需要可验证的邮箱；绑定入口在账号页。
3. 邮箱验证码需要 `RESEND_API_KEY` 与已验证发件域名的 `MAIL_FROM`。验证码 5 分钟有效，最多 5 次尝试。
4. Judge0 部署在独立 Linux 沙箱主机，最低修补版 1.13.1，限制入口与网络。设置 HTTPS `JUDGE0_URL`、`JUDGE0_TOKEN`，从该实例 `/languages` 读取 ID 后配置 `JUDGE0_LANGUAGE_IDS`，格式如 `{"python":实际ID,"go":实际ID,"java":实际ID,"cpp":实际ID}`。不要直接复制旧版教程 ID。
5. Cloudflare Stream 设置 `STREAM_ACCOUNT_ID` 和具有 Stream 编辑/签名权限的 `STREAM_API_TOKEN`。在教师发布页填写视频 UID，平台将强制其私密播放。
6. Stripe 配置 `STRIPE_SECRET_KEY`（推荐最小权限受限密钥）、`STRIPE_PRICE_GOMALL` 和 `STRIPE_WEBHOOK_SECRET`。Webhook 地址 `/api/stripe/webhook`，订阅 `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`charge.refunded`。用测试环境验证成功、取消、100% 优惠、重复事件、全额/部分退款和通知乱序后再启用正式收费。
7. 对外开放前关闭 `ENABLE_CHATGPT_AUTH`，启用自己的 Google/GitHub/邮箱登录。确认定价、税务和退款政策，完成真实学员邮箱认领与正式视频/判题联调。

工单附件存入私有 R2，通过登录与工单权限检查后下载；每个工单最多 10 个附件，每个最多 2MB。站内通知不自动发送外部邮件。签名视频已有令牌在撤权后最多保留 1 小时。D1 数据库与 R2 附件存储绑定定义在 `.openai/hosting.json`，源代码独立于 Gomall 商城。

更多取舍与许可证见 [docs/DECISIONS.md](docs/DECISIONS.md)。
