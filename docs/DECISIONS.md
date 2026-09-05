# cswork 技术决策

- 与 CSGrad 无产品关联，只共用 `192.18.137.70` 主机；不读取它的用户、课程、Worker、数据库或环境文件。
- React/Vinext standalone 正式 Node 服务，保留现有界面；移除 Sites 和 Cloudflare Worker 运行依赖，不以 `wrangler dev` 或 Miniflare 模拟器承担正式流量。
- SQLite/better-sqlite3 + Drizzle。业务原有 SQL 接口由小型封装承接，批操作同步事务保证支付授权、课程发布等原子性。Better Auth 的异步适配器继续使用 `transaction: false`，不把异步回调塞进同步 SQLite 事务。
- Better Auth 1.7 账号包含必填 issuer，采用明确的 provider-id 策略；增量迁移保留原账号、密码、OAuth 令牌并回填来源。老师权限只从经过验证的邮箱与服务器 ADMIN_EMAILS 推导。
- Google/GitHub/邮箱验证码保留独立接入；新增 CLI 初始化老师和密码登录，关闭公开密码注册；移除全部 Sites 身份头后备入口。
- 私密附件按随机 UUID 存入 Web 根目录之外，每个最多 2MB、每个工单最多 10 个；下载必须通过账号与工单归属检查。
- nginx 独立 vhost + systemd 独立用户，CPU 和内存设上限。SQLite 与附件不随版本目录切换；启动检查失败回退应用版本，数据库恢复需从备份明确执行。
- Judge0、Stripe、Cloudflare Stream 是独立可选服务，缺少配置不伪造结果。服务器已有其他产品的服务不作为 cswork 的隐式依赖。

## 主要复用组件

| 用途       | 组件                       | 许可证           |
| ---------- | -------------------------- | ---------------- |
| 应用       | React / Vinext             | MIT              |
| 身份       | Better Auth                | MIT              |
| 数据库     | better-sqlite3 / Drizzle   | MIT / Apache-2.0 |
| 编辑器     | CodeMirror 6               | MIT              |
| 视频播放器 | Video.js                   | Apache-2.0       |
| 判题服务   | 独立 Judge0 CE             | GPL-3.0          |
| 支付       | Stripe 官方 SDK / Checkout | MIT / 托管服务   |

参考：[AcWing 算法基础课](https://www.acwing.com/activity/content/11/)、[Better Auth 1.7 迁移](https://better-auth.com/docs/guides/1-7-upgrade-guide)、[Drizzle SQLite](https://orm.drizzle.team/docs/sqlite/get-started-sqlite)、[Vinext](https://github.com/cloudflare/vinext)。只参考 AcWing 的课程组织方式，没有复制其课件、题库或私有页面。
