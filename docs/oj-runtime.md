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

## C++ 首次编译与测试点等待（2026-09-06）

真实提交显示出队只需 47–194 ms，但每次修改 C++ 后第一次运行仍需约 5.5 秒编译。此前按用户缓存完整二进制只能加速相同代码再次提交，不能解决编辑后首次运行。

镜像现在以同一 g++、C++20、`-O2 -pipe` 预编译标准库头文件，放在只读 `/usr/local/include/cswork/stdc++.hpp.gch`（ARM64 约 176 MiB）。仅 LeetCode 隐藏上下文引用它；学员源码仍以原优化等级重新编译。旧镜像没有该头文件时自动使用普通标准头；GCC 也会在 PCH 与编译参数不兼容时退回头文件。ACM 源码、语言配置和用户模板不变。PCH 随工具链镜像重建，不混用其他编译器版本生成的文件。

worker 仍一次处理一个提交，复用执行器现有的两个槽，让至多两个测试点同时运行；每例仍是独立沙箱，按自己的 CPU/墙钟/内存和输出限制判定。内存限制超过 512 MiB 的题目维持串行。结果和分数按测试点原序写入，取消、错误或资源超限提前退出时先等待已启动的邻例结束，再释放二进制，避免悬空任务与缓存清理竞态。不会减少测试点或共享学员进程状态。

同一服务器、同一正确 lc-53 C++ 源码、完整 31 个测试点的隔离实测：

| 路径 | 首次新代码 | 相同代码再次执行 |
| --- | ---: | ---: |
| 原 go-judge 编译与逐例执行 | 8084 ms | 2357 ms |
| PCH 与两个独立测试点并行 | 4745 ms | 1287 ms |
| 新 bundle worker 含真实队列与结果落库 | 4963 ms | 1455 ms |

首次编译本身由 5669 ms 降至 3484 ms。数据来自隔离 SQLite 副本、唯一 BullMQ 队列和 loopback 5051 临时 runner，不写生产提交。耗时会随源码、测试规模与机器负载变化，不是每道题的固定时限。

已有 runner 可用 `Dockerfile.pch` 基于当前镜像的不可变 image ID 构建小型升级，避免重编译 go-judge；完整新安装的 `Dockerfile` 也执行同一 `build-cpp-pch.sh`。替换前保留旧镜像标签，等在途任务归零后暂停 worker，再替换 sandbox，检查健康并重启 worker以清空旧执行器缓存。回滚为旧镜像后，新网页与 worker 的普通头 fallback 仍可运行。

## 从提交点击到结果显示（2026-09-06）

参考 LeetCode 的运行结果面板与提交记录流程（[官方操作说明](https://support.leetcode.com/hc/en-us/articles/360012016874-Start-your-Coding-Practice)）。其完整编译/调度实现未公开，本项目不据此声称采用相同后端或相同耗时。

点击提交立即清空上一结果并显示提交状态；收到正式提交编号后展示实际阶段。待处理详情附带仅包含状态的 `watchToken`。客户端立即发送有界等待请求，服务端每 100 ms 检查阶段与终态，消除旧轮询的固定 750 ms 等待；普通用例进度每 500 ms 合并，避免频繁重新读取完整结果。watch 使用独立每用户 360/min 额度，最多同时两个等待，异常退回兼容的普通读取。缺少完整详情的 POST 回执始终可重查，即使回执表示幂等复用的任务已完成。

每次等待最长 3 秒后续接，查询只读少量状态字段，返回前再次使用现有所有权校验与隐藏测试过滤。当前 Vinext Node bridge 不把 socket 断连映射到 Request.signal，因此生产断连依靠 3 秒硬上限释放等待槽；支持 signal 的调用可立即取消。不会为此改变框架或暴露内部队列。

回归包括即时上传状态、watch 无750ms空窗、失败回退、AC去重、已完成回执详情读取失败后的恢复，以及权限/并发/高频进度合并/3秒上限。模拟服务端20ms后完成时，等待接口约103ms收到终态；这是通知延迟，不是代码编译与测试的总耗时。

普通 C++ 接口现在按受信任的官方模板选择较轻的传输代码：仅明确为标量、字符串及嵌套 vector 的单个 Solution 方法省略不会用到的 Graph 加载/序列化分支。标准节点声明和其他运行时保持不变；节点接口、设计类、Codec、未知声明及用户代码显式引用平台节点时保留完整实现。500题中384题适用，编译缓存按完整包装源码区分。

真实同机、同-O2、同资源、完整31例lc53对照：旧包装冷执行4725ms（编译3452ms）、缓存1272ms；新包装冷执行3399ms（编译2166ms）、缓存1213ms，均31/31通过。冷路径减少约28%。这里不含浏览器、网络和任务排队；12项原生编译回归覆盖普通值、矩阵修改、字符串、自定义节点、树/链表、Node、Interval、MountainArray、LRU和Codec。仅裁剪不可达的传输分支，不减少测试或改变单例进程隔离。
