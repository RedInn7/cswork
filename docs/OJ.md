# 编辑器与算法判题

cswork 使用 Monaco Editor 作为浏览器编辑器、BullMQ 作为持久化任务队列、go-judge 1.12.3 作为独立 Linux 执行内核。业务层保存课程权限、不可变题目版本、提交和逐点结果。部署细节与实际隔离配置见 [运行时说明](oj-runtime.md)。

## 学员工作区

- 自托管 Monaco 与 editor worker，无 CDN；四种语言的语法高亮、括号匹配、折叠、查找替换、多光标、快捷键和代码 diff。Python、Go、C++、Java 通过独立语言服务器提供成员/函数补全、参数提示和悬停说明；Python、Go、C++ 另有实时诊断，Java 的编译错误通过运行/提交查看。可点击「代码补全」或按 Ctrl + Space；状态栏显示服务启动、就绪或暂不可用。
- 可拖动题面、编辑区与控制台分隔条；窄屏切换题面和代码；字体、主题、Tab 宽度、自动换行独立保存。
- 草稿按账号、题目与语言隔离；离开/切换前保存，可下载代码、确认后恢复模板。历史提交可查看源码并与当前草稿比较，查看历史不会停止正在运行的提交。
- “运行”支持公开样例和自定义标准输入；“提交”执行发布版本全部测试点。自定义运行不影响通过题数与老师的反复失败提醒。
- 隐藏测试点只显示编号、结论、时间和内存，不返回输入、答案、stdout 或 stderr。公开输出每项最多保留 64 KiB，编译信息最多 64 KiB。

## 题目和发布

教师工作台 → 题库管理，可编辑题面、课程章节归属、资源限制、语言、公开/隐藏测试点及权重。支持 JSON 导入导出、单独导入测试点输入输出文件。文件为 `schemaVersion: 1` 的声明式数据，不接受任意执行命令或自定义可执行 checker。

草稿使用 revision 乐观锁；冲突保留本地编辑，要求重载服务器版本后再保存。发布在单一 SQLite 事务中新增不可变版本、写入测试点并切换当前版本；数据库触发器禁止修改历史版本或追加历史测试点。恢复旧版本只复制到草稿，重新发布才会产生新版本。每次提交绑定当时的 version ID，worker 重算快照 SHA256 后才执行，后续题目修改不改变在途任务。

限制：导入总 JSON ≤8 MiB、2–64 测试点、每点输入/答案 ≤4 MiB；至少一个公开样例及一个隐藏点。CPU 0.1–10 秒/点，内存 16–512 MiB，输出 1–4096 KiB。`tokens` 按 ASCII 空白比较 token；`exact` 仅规范化 CRLF 后逐字比较。

## 持久化与运行

`POST /api/oj/submissions` 使用调用方生成的幂等键，在单一 SQLite 事务中写入提交与 outbox。相同键与相同请求返回原提交；相同键不同请求返回 409。队列暂不可达时已经接受的提交不会丢失。

worker 每 5 秒把未完成提交投递到 BullMQ，使用 submission ID 作为 job ID。Redis 启用 AOF、noeviction；worker 可在 Redis 数据恢复/重建后由 SQLite 重建未完成队列。任务并发 2，队列容量 128；每学员最多两份未完成任务，每分钟正式提交 6 次、运行 12 次。代码和自定义输入各≤64 KiB。

编译一次后复用本次提交的缓存产物逐点运行，在 finally 删除缓存，执行器 TTL 兜底。编译 CPU 最多30秒/墙钟60秒、内存1GiB；运行使用题目资源限制、64进程/线程上限和独立输出限制。整次截止时间依据实际测试点数量计算：80秒余量加各点墙钟预算（max(3秒, CPU限制×3)），保证合法长题集不会被隐含固定时间截断。资源失败停止后续测试点并标为未运行，答案错误继续检查后续点。

基础设施异常由 BullMQ 最多重试3次，重启造成的 stalled job 由 BullMQ 恢复。SQLite attempt 自增并对结果写入做版本校验，旧任务不能覆盖新任务；跨队列重建累计尝试最多8次。用户取消持久化后中断执行请求；启动维护会收束崩溃前遗留的取消任务。GET 结果不触发执行或改写提交。

生产仅运行一个 `cswork-oj-worker.service`（内含2并发任务），web 进程只持有 `OJ_ENABLED=true`，执行器/Redis凭据由 systemd 单独从 `/etc/cswork/oj.env` 注入 worker。`OJ_QUEUE_NAME` 默认 `cswork-judge-v1`；集成测试必须使用独立 test 队列、临时数据库和本地端口，不能与生产队列混用。

## API

| 接口                                         | 用途                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `GET /api/oj/status`                         | 已登录用户查看 worker 心跳、排队数和语言版本                              |
| `GET /api/oj/problems/:id`                   | 检查课程授权后返回公开题面与样例                                          |
| `POST /api/oj/intelligence`                  | 已授权题目的 completion/hover/signature/diagnostics；用户身份由服务端注入 |
| `POST /api/oj/intelligence/close`            | 释放当前编辑会话；页面退出与闲置超时也会回收                              |
| `POST /api/oj/submissions`                   | `{problemId,language,code,mode,idempotencyKey,stdin?}`                    |
| `GET /api/oj/submissions?problemId=&cursor=` | 当前用户历史，游标分页，每页20条                                          |
| `GET /api/oj/submissions/:id`                | 提交详情；本人或老师可见                                                  |
| `POST /api/oj/submissions/:id/cancel`        | 幂等取消                                                                  |
| `GET /api/oj/admin/problems[/:id]`           | 教师题库与草稿/版本                                                       |
| `POST /api/oj/admin/problems/save`           | `{payload,expectedRevision}`                                              |
| `POST /api/oj/admin/problems/:id/publish`    | `{expectedRevision}`                                                      |
| `POST /api/oj/admin/problems/:id/restore`    | `{versionId,expectedRevision}`                                            |

`mode` 只有 `judge`/`run`。`run` 缺省 stdin 表示公开样例；明确传入 stdin（包括空字符串）表示自定义输入。运行成功终态 `finished`，正式通过 `accepted`，其余状态见 `lib/oj-client.ts`。

## 验证

```sh
npm run typecheck
npm run test:oj
npm run test:editor
npm run build
```

单元/数据库测试使用临时 SQLite，并运行真实迁移；覆盖权限、幂等、取消、隐藏数据、checker、不可变版本、CAS冲突和严格导入。完整 HTTP 与真实四语言执行验收通过 `tests/oj-integration.mjs` 在隔离环境进行。运行时安装后的语言、内存、CPU、输出、网络/文件隔离和 Redis 持久化验证使用 `deploy/oj/verify-runtime.py`。

## 语言分析的边界

安装、健康检查与回滚见 [语言服务运维说明](language-service.md)。

语言服务只分析当前题目的单个源文件和标准库，不执行学员代码，也不安装用户依赖。浏览器只使用补全的文本编辑，不执行 LSP 命令或工作区修改。真实运行和评测始终由独立 OJ 完成；编辑器提示不能替代编译与测试结果。

每个账号、题目、语言和打开的编辑器拥有独立容器，没有网络和业务目录挂载。单机最多同时 4 个语言会话，每人最多 2 个；闲置 3 分钟释放，首次启动可能需要等待，Java 通常较慢。补全请求限每人每分钟 240 次，和判题提交配额分开。代码上限 64 KiB，补全最多 100 项，响应上限 1 MiB。
