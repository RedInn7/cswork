# cswork 验收记录

- 正式 standalone Node 服务下 **57 项真实 HTTP 检查通过**：密码登录、错误密码、禁止公开密码注册、会话、邮箱验证与课程授权、跨学员隔离、私密工单与附件、老师回复、版本冲突、作业评审、CSRF、撤权。
- 旧 Sites 身份请求头无法冒充老师；独立验证篡改 Cookie、未签名 Cookie 被拒绝，未验证邮箱不能获得教师权限。
- 独立复核并验证 SQLite batch 失败全部回滚、迁移重复执行、Better Auth issuer 迁移、退款事件乱序不重新授权、附件实际字节上限、草稿保存和视频续播。
- TypeScript 检查与 macOS、服务器 Linux ARM64 上的生产构建通过。服务器安装在 nginx 校验成功后平滑重载；启动失败有应用版本回退。
- 默认 lint 尚有生成的 shadcn 组件规则冲突，以及业务显式 any、React Compiler effect/ref 和标签提示，未通过；未修改规则隐藏结果。未执行完整浏览器视觉/端到端验收。
- Google/GitHub、验证码邮件、Stream、Judge0、Stripe 仍需独立真实配置与联调；不宣称已完成正式招生收费验收。

前一版私有原型的 WebMCP 已验证读取 17 个章节、打开授权章节、无副作用读回和无效参数拒绝。迁移未更改这些工具的契约。
