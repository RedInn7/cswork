# cswork 独立判题运行时

判题执行复用 [go-judge v1.12.3](https://github.com/criyle/go-judge/releases/tag/v1.12.3)，固定上游 commit `1f3ac5b3d9dd012540531c6564b091fe78d39cdb`。持久化任务队列使用 BullMQ 的独立 Redis。它们与 CSGrad 只共享物理服务器，不共享账号、数据库、题目、密钥、容器或目录。

## 组件与维护

| 资源 | 配置 |
| --- | --- |
| 沙箱 | `cswork-oj-sandbox`，仅 `127.0.0.1:5050` |
| 队列 | `cswork-oj-redis`，仅 `127.0.0.1:6381` |
| 配置 | `/etc/cswork/oj.env`，root:root 0600 |
| 发布文件 | `/srv/cswork/oj/` |
| Compose | `/opt/cswork/runtime/docker-compose`，官方 v5.5.1 SHA256 校验 |
| 网络 | `cswork-oj_judge`，独立 Docker bridge，发布端口只绑定 loopback |
| Redis 数据 | `cswork-oj_redis-data` 独立 Docker volume |

环境变量为 `GO_JUDGE_URL`、`GO_JUDGE_TOKEN`、`REDIS_URL`。`REDIS_PASSWORD` 仅供 Redis 容器启动；密码为随机 hex，可安全放入 Redis URL。只有 worker 的 systemd unit 追加 `EnvironmentFile=/etc/cswork/oj.env`，由 systemd 以 root 读取；Web 进程仅设置 `OJ_ENABLED=true`，不持有沙箱或 Redis 凭据。验收脚本把四种语言的真实版本写入同一环境文件的单行 `OJ_LANGUAGE_VERSIONS` JSON，供 worker heartbeat 提供给前端。

```sh
sudo bash deploy/oj/install.sh
sudo python3 /srv/cswork/oj/verify-runtime.py
sudo /opt/cswork/runtime/docker-compose --project-directory /srv/cswork/oj --env-file /etc/cswork/oj.env ps
sudo docker logs --tail 60 cswork-oj-sandbox
```

仅在没有运行任务的维护窗口运行 `verify-runtime.py --restart-redis`；该选项实测 AOF 在容器重启后保留测试键。默认验证不重启服务、不清空队列。

Redis 开启 AOF，`appendfsync everysec`、`maxmemory-policy noeviction`。这保证内存压力时返回明确错误而不是驱逐任务；它不等于零丢失磁盘持久化，应用必须依赖 SQLite outbox 恢复尚未完成的提交。不要运行 `docker compose down -v`。异地备份需覆盖应用数据库和 Redis volume；当前本机卷并非异地灾备。

## 安全边界

沙箱容器不是 privileged，不挂载宿主目录、Docker socket 或任何应用环境文件，不使用 host PID/network/cgroup namespace。只增加创建嵌套沙箱需要的 `SYS_ADMIN`，移除 `NET_RAW`，启用 `no-new-privileges`；AppArmor 仅对这个容器使用 `unconfined`。外层 seccomp 从固定 [Moby 官方 allowlist](https://github.com/moby/profiles/blob/3c28324314729dbade8287e868eef6338c42807a/seccomp/default.json) 衍生，仅增加沙箱初始化需要的 pivot_root，并将 clone3 改为 ENOSYS，未禁用整个过滤器。`systempaths=unconfined` 仅让受信执行器创建嵌套 user namespace 的 `/proc`，实际学员进程仍使用内层只读 proc 和敏感路径遮蔽。这是 Docker 嵌套 rootless 容器的已知约束，参见 [Moby 官方说明](https://github.com/moby/buildkit/blob/master/docs/rootless.md)。应用不能提交任意 args、copyIn.src、挂载、环境变量或限额，服务端只接受语言白名单、代码和受限 stdin，再生成固定执行请求。

入口只把自己的私有 cgroup v2 挂载改为可写，供 go-judge 创建子 cgroup，不接触宿主完整 cgroup 树。不改变主机 sysctl、Docker daemon、grub 或其他服务。执行器启动启用 `no-fallback`，健康验收额外核验 cpu/memory/pids 控制器，避免资源限制静默失效。

官方 go-judge 二进制未带 seccomp build tag，因此本项目从固定源码以 `seccomp,nomsgpack,grpcnotrace` 构建，并附带两行补丁移除上游启动日志中的完整配置和鉴权 token 输出。启动必须出现 `loaded seccomp filter`，并由真实代码验证网络 socket 与 unshare 被拒绝。ARM64 策略阻止网络及敏感内核管理调用，同时保留 Go/Java 线程；外层对 clone3 返回 ENOSYS，线程和 go-judge 回退到可以检查 namespace flags 的 clone。更新镜像或策略后应重新验证，不能只确认配置文件存在。

每次编译和运行都在独立 PID/user/mount/network/IPC/UTS namespace 中。执行代码 UID/GID 1536、有效 capability 为零、NoNewPrivs 为 1。只读语言工具链来自判题镜像自己的 `/usr` 等目录；`/w`、`/tmp` 使用各 256MB tmpfs，系统敏感 proc 路径沿用上游遮蔽规则。绝不在 Web 进程或宿主直接执行学员代码。

容器总上限 2 CPU、4GB RAM（不允许额外 swap）、512 进程；沙箱内部最多并发 2。每次运行另外提供 CPU 时间、墙钟时间、内存、进程、stdout/stderr 和文件上限。Redis 上限 384MB、0.5 CPU。构建命令也限制为 2 CPU、2GB，避免占满同机服务的资源。

这里的 namespace/seccomp 沙箱仍共享 Linux 内核，不等于独立虚拟机。应继续安装宿主安全更新；若扩展到大规模公开匿名执行，应把此组件迁移到专用判题主机/VM，并保持相同内部 HTTP 接口。

## 接口契约

请求使用 `Authorization: Bearer <GO_JUDGE_TOKEN>`，`POST /run` 请求为 `{ "cmd": [ ... ] }`，返回结果数组。`cpuLimit`、`clockLimit`、`time`、`runTime` 单位为纳秒；`memoryLimit`、`memory`、输出限制单位为字节。

编译后 `copyOutCached` 返回 `fileIds`，测试点通过 `copyIn: { "main": { "fileId": "..." } }` 引用同一可执行文件，不重复编译。Java 固定执行 `javac Main.java` 后将所有 `.class` 放入 `main.jar`，不能只缓存 Main.class 而丢失内部类。固定 shell 片段不拼接学员代码，源码只通过 `copyIn` 内容传递。Go 使用 `GOTOOLCHAIN=local`、`GOPROXY=off`、临时 GOCACHE。

执行器的 `Accepted` 只表示程序正常退出，业务 worker 仍要比较输出。编译失败归编译错误；运行失败区分时间、内存、输出、运行错误；执行器自身异常归系统错误。隐藏测试输入和预期答案只在服务端，不回传给学员。HTTP 连接取消会传播到执行上下文；worker 在 finally 中释放本任务的编译产物租约；同账号同源码的成功编译可在最多 8 项、5 分钟缓存中复用，过期、淘汰、故障与停机时删除。执行器的 10 分钟 TTL 仍是崩溃兜底。

stdout/stderr collector 应使用 `pipe: true`。另外必须优先处理 `fileError` 的 `CollectSizeExceeded` / `CopyOutSizeExceeded`：上游可能在输出超限时同时返回 `Nonzero Exit Status`（例如 Python 捕获文件过大错误），只映射顶层 status 会误报成普通运行错误。

## 2026-09-05 实际验收

服务器完成 39 项真实运行检查：C++20/Python/Java/Go 编译执行与正确输出；C++ 多测试点复用编译缓存；Java JAR；cgroup v2 cpu/memory/pids；鉴权拒绝；非 privileged、无宿主目录挂载、私有 PID/network/cgroup；UID 1536、零 capability、NoNewPrivs 和 seccomp；外网 socket 与 unshare 拒绝；宿主配置、目录、Docker socket 不可访问；CPU/墙钟超时、内存、输出、进程上限；运行/编译错误；测试点间临时文件清理；客户端取消实际终止沙箱进程；Redis 密码、AOF、noeviction、everysec 及重启持久化。缓存文件在 finally 中清理。

实际工具链：g++ 14.2.0（C++20）、Python 3.13.5、OpenJDK 21.0.12.1、Go 1.24.4；go-judge 本身由 Go 1.26.8 构建。两个容器健康检查通过，端口只监听 127.0.0.1。验证期间服务器可用内存约 20GB。没有更改或重启 CSGrad、宿主 cgroup/sysctl 或 Docker daemon。

参见 [官方 API](https://docs.goj.ac/api)、[资源配置](https://docs.goj.ac/configuration)、[挂载规范](https://docs.goj.ac/mount)。go-judge 为 MIT，构建启用的 Elastic seccomp 组件为 Apache-2.0；固定 Redis 8.x 可按其 AGPLv3 选项使用。保留镜像内许可证；不能将旧 Hydro 镜像中的已撤回 go-judge 版本用于部署。

## 大答案验收与发布要求

2026-09-06 在独立 5051 runner、隔离队列上完成 36 个判题结果和 423 次 HTTP 请求检查：Python/C++/Java/Go 集合与整数行规则通过；21,688,897 字节隐藏答案正确判为 AC，超出题目 32 MiB 限额判为 OLE。worker 峰值 RSS 为 774,568 KiB；隐藏 stdout/stderr 未持久化或回传。

runner 全局 output/copy-out 上限为 64 MiB，仍按题目单独限制。worker 同时处理一个提交，Node heap 3072 MiB，systemd MemoryHigh 3 GiB、MemoryMax 4 GiB；快照总输入和答案不超过 128 MiB。输入每项仍 4 MiB，公开样例仍 32 KiB。Nginx 只为已鉴权教师题目保存路径提供较大请求额度，其余请求沿用原限制。

部署时必须同时更新 runner 镜像、web/worker bundle、worker systemd 单元和专用 Nginx snippet；只部署网页无法解除旧 runner 的 16 MiB 硬上限。先等在途判题结束再替换 runner，并核验实际进程参数、服务健康和运行检查。

另在隔离数据库和受限临时 web 服务上实测 133,694,172 字节（约 127.50 MiB）题包，含一个精确 64 MiB 的隐藏答案。导入、发布、公开接口隐藏字段省略全部通过；cgroup MemoryPeak 2,642,690,048 字节（2.46 GiB），high/max/oom/oom_kill 事件均为 0。因此 web 也采用 heap 3072 MiB、MemoryHigh 3 GiB、MemoryMax 4 GiB，不能继续使用旧 1 GiB 额度。
