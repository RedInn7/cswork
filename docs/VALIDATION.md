# cswork 验收记录

## 前版独立部署基线

2026-09-05 前版已在 CSGrad 所在服务器完成独立部署：[cswork](https://cswork.192.18.137.70.sslip.io)。独立证书生效，HTTP 跳转 HTTPS，cswork 与 csgrad.com 均返回 200。以下基线记录不代表本轮 Monaco/OJ 应用版本已完成生产发布。

线上检查通过：真实老师密码登录、Secure/HttpOnly 且限定当前主机的 Cookie、教师权限、匿名课件访问拒绝、身份头伪造拒绝、同源写入与跨源拒绝、退出后旧会话失效。老师账号在服务重启后保留；第一次在线数据库及附件备份成功，每日定时备份已启用。

- 正式 standalone Node 服务下 **57 项真实 HTTP 检查通过**：密码登录、错误密码、禁止公开密码注册、会话、邮箱验证与课程授权、跨学员隔离、私密工单与附件、老师回复、版本冲突、作业评审、CSRF、撤权。
- 旧 Sites 身份请求头无法冒充老师；独立验证篡改 Cookie、未签名 Cookie 被拒绝，未验证邮箱不能获得教师权限。
- 独立复核并验证 SQLite batch 失败全部回滚、迁移重复执行、Better Auth issuer 迁移、退款事件乱序不重新授权、附件实际字节上限、草稿保存和视频续播。
- TypeScript 检查与 macOS、服务器 Linux ARM64 上的生产构建通过。服务器安装在 nginx 校验成功后平滑重载；启动失败有应用版本回退。
- 前版默认 lint 存在生成的 shadcn 组件规则冲突，以及业务显式 any、React Compiler effect/ref 和标签提示；当时未通过，也未执行完整浏览器视觉/端到端验收。本轮实际浏览器检查见下节，未将其扩大为全站验收或全仓库 lint 通过。
- 前版 Judge0 适配器没有配置实际判题服务；本轮已由真实部署的 go-judge 与 Redis 替代。Google/GitHub、验证码邮件、Stream、Stripe 的独立配置与联调不在下述 OJ 验收结果中，仍不宣称完成正式招生收费验收。

前一版私有原型的 WebMCP 已验证读取 17 个章节、打开授权章节、无副作用读回和无效参数拒绝。迁移未更改这些工具的契约。

## 2026-09-05：Monaco 与真实 OJ 升级

以下全面回归在同一服务器的独立 staging 数据库、`localhost:4318` 应用及测试队列上取得；随后完成生产发布与下方线上验证。

- Node/ARM64 正式构建成功，包含 self-hosted Monaco worker 与独立 BullMQ worker 制品。
- 最终 TypeScript 全项目检查通过。题库与提交 14 组测试通过，覆盖真实 SQLite 迁移、权限、快照不可变、并发发布及 26 个测试点的独立参考算法校验，见 [题库测试](../tests/oj-problems.test.ts) 与 [提交测试](../tests/oj-submissions.test.ts)。
- 原有 **57 项真实 HTTP 集成检查在当前新版再次全部通过**，覆盖登录、会话、课程授权、工单/附件隔离、教师操作、版本冲突、CSRF 和撤权，见 [集成测试](../tests/integration.mjs)。
- 请求生命周期 **8 项测试及 19 项真实 HTTP 断连回归通过**，覆盖请求读取、响应与连接中断处理，见 [生命周期测试](../tests/request-lifecycle.test.ts)。
- 专属 go-judge/Redis 容器39项真实检查通过，涵盖四语言、鉴权、cgroup CPU/memory/pids、进程身份、seccomp、无网络、宿主文件拒绝、编译缓存/测试点清理、HTTP取消及AOF重启持久化。
- 临时 staging 数据库与独立 test 队列通过 **15 个真实 E2E 场景、151 次 HTTP 请求、15 份真实提交**。四语言全量 AC 与 WA/CE/RE/TLE/MLE/OLE 均正确；样例、自定义输入、显式空 stdin、幂等、隐藏结果隔离、撤权、取消和 SIGKILL 恢复均覆盖。测试用户、提交及脚本自建 worker 均已清理，SQLite 文件所有权已恢复，见 [真实判题验收脚本](../tests/oj-integration.mjs)。
- 浏览器实际操作通过：Monaco 输入；语言间独立草稿及刷新恢复；公开样例运行；Python 正式提交 **6 个测试点全部通过、100 分**；历史提交源码查看及与当前草稿的 diff。此结果验证了编辑、运行、提交和回看流程，不代表尚未配置的第三方服务已完成验收。
- 教师题库管理已在浏览器检查真实 4 道题列表、题面编辑字段和 6 个测试点的编辑字段。
- **390 × 844** 手机视口下，题面/代码分屏正常，Monaco 加载成功，运行与提交按钮可见；`document.scrollWidth = innerWidth = 390`，未发生页面横向溢出。检查后已恢复原视口。
- 独立agent复查并修复取消任务崩溃后占用名额、固定总超时误伤合法长题集。实际联调修复BullMQ6的ioredis可选peer漏打包和go-judge输出限制分类。
- Vinext升级至1.0.0-beta.9，DOMPurify固定3.4.14，Undici补丁更新；npm audit已无high/critical，剩余4项moderate均来自Drizzle构建工具的旧esbuild链路，不在standalone请求运行路径中。

### 本轮生产发布

2026-09-05 23:43 UTC 发布 `0f5b46f361ba24df9b2551003e79904da59647f4`，访问地址仍为 [cswork](https://cswork.192.18.137.70.sslip.io)。由已提交源码在服务器完成 ARM64 生产构建；迁移前数据库及附件备份成功，迁移完成后应用和 OJ worker 均通过启动健康检查。

- `cswork.service`、`cswork-oj-worker.service`、nginx 均 active，独立 go-judge/Redis 容器均 healthy，运行时只监听 loopback 5050/6381。
- 现有老师账号真实 HTTPS 登录、host-only Secure/HttpOnly Cookie、教师权限、匿名拒绝、CSRF 和退出后会话失效再次通过，没有重置原账号或密码。
- 线上 OJ 报告 available，返回 C++/Python/Java/Go 四种真实版本；授权题目和教师 4 题列表正常，匿名 OJ 状态请求返回 401。
- 经线上 API 创建一次自定义测试运行，实际由生产队列和 worker 执行 Python，输入 `1 2 3`，返回 `finished`、输出 `6`，耗时约 13 ms。该运行不计正式提交、题目通过或学员学习进度。
- CSGrad 的 HTTPS 仍为 200；未修改其应用、配置或证书。部署后空闲应用内存约 99 MiB、worker 48 MiB，分别受 1 GiB 与 512 MiB 上限约束。
- 已停止本轮专属 staging web/worker 并关闭临时验收页面；未停止其他项目服务。
