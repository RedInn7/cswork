# SDE Academy 首版决策

目标是把现有 SDE 付费课程、算法练习和老师反馈连起来。课程来自教师拥有的 Gomall 仓库；平台使用独立目录与私有仓库，原商城不改动。首版参考 AcWing 公开课程页的章节、大纲与配套练习组织，不复制其付费内容或未观察到的登录后界面。

## 已采用的默认值

- 首发课程：GoMall 后端工程实战，17 份真实讲义、4 道原创算法题。讲义中的工程实践可通过 GitHub 仓库或 PR 提交评审。
- 老学员：按验证过的购买邮箱授予当前 SDE 完整课程永久权限；未来新课默认不自动包含。老师可显式选择“全部课程（含未来）”。新注册用户没有课程权限。
- 新客售课：Stripe 托管 Checkout，一次性购买，价格只来自服务器配置的 Stripe Price；不在前端硬编码收费金额。支持 Dashboard 优惠码。全额退款撤销对应订单授予的权限，其他独立授权不受影响；部分退款默认保留课程。
- 账号：Better Auth，Google、GitHub、邮箱验证码；同邮箱账号绑定必须由已登录用户主动发起。正式登录需要 OAuth/邮件服务配置。Sites 预览另外使用平台验证的 ChatGPT 身份，教师仅由服务器 ADMIN_EMAILS 白名单决定。
- 视频：Video.js + Cloudflare Stream，发布时强制 requireSignedURLs；课程权限校验后发 1 小时播放令牌。撤权后不再签发新令牌，已签发令牌最多仍可用 1 小时。没有伪造视频/时长或观看记录。
- 判题：CodeMirror + 独立 Judge0 HTTP 服务，Go/Python/Java/C++。语言 ID 必须从实际实例读取。隐藏用例仅服务端持有，固定资源上限并禁止联网，不在 Web Worker/本机直接运行不受信任代码。
- 私密工单：本人及老师可见，可关联章节、视频时间、提交；老师回复产生站内通知。教师工作台按等待时间组织，并显示待评审作业和近 7 天至少三次失败且未通过的题目。
- 更新：逐课不可变修订，保留版本和正文快照；重要程度与已读状态分离。初次发布时才写入真实发布时间。
- 部署：Workers + D1，先仅站点所有者可见。对公开招生的域名、币种、税务注册、退款条款和课程实际定价，留到正式销售接入时确认；没有用猜测信息开通收款。

## 开源复用及边界

| 部分     | 组件                        | 许可证 / 来源                                                    |
| -------- | --------------------------- | ---------------------------------------------------------------- |
| 页面框架 | React、Vite、Vinext         | MIT / https://github.com/cloudflare/vinext                       |
| 基础交互 | shadcn / Base UI            | MIT / https://ui.shadcn.com/ / https://base-ui.com/              |
| 登录     | Better Auth                 | MIT / https://better-auth.com/docs                               |
| 数据库   | Drizzle + D1                | Apache-2.0 / https://orm.drizzle.team/docs/connect-cloudflare-d1 |
| 编辑器   | CodeMirror 6                | MIT / https://codemirror.net/                                    |
| 播放器   | Video.js                    | Apache-2.0 / https://videojs.com/                                |
| 判题服务 | Judge0 CE（外置，未打包）   | GPL-3.0 / https://github.com/judge0/judge0                       |
| Markdown | react-markdown / remark-gfm | MIT / https://github.com/remarkjs/react-markdown                 |

这里复用成熟底层而不直接 fork 完整 LMS：Moodle / Open edX 的部署和主题改造负担较大，通用 OJ 也不涵盖付费授权、私密辅导和课程版本。首版自己的代码集中在这些业务衔接上。Piston 公共 API 当前不向收费项目授权，不作为运行依赖。

React、react-dom、react-server-dom-webpack 同步到 19.2.8，RSC 插件到 0.5.29，覆盖已公布的 RSC DoS 补丁。其余审计项来自构建工具链；不通过盲目 force 更新破坏锁文件。Vinext beta 是当前 Sites 模板要求，公开商业上线前需持续验证其升级和兼容性。

## 当前边界

没有自动迁移真实学员名单、没有代发通知邮件、没有真实 OAuth 登录或实际收费，外部集成仅在有配置时开放。没有公网判题沙箱凭据时明确返回不可用，不伪造 AC。正式销售前仍需真实服务联调和上线验收。AI 自动答疑、排行榜、竞赛、自动项目测试和复杂营销不在首版范围。
