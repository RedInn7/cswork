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

执行器的 `Accepted` 只表示程序正常退出，业务 worker 仍要比较输出。编译失败归编译错误；运行失败区分时间、内存、输出、运行错误；执行器自身异常归系统错误。隐藏测试默认不回传；正式提交首错停止后，仅本人和老师可读取该首个失败用例的限长诊断，其他隐藏测试仍保密，详见[首错反馈规则](oj-first-failure-feedback.md)。HTTP 连接取消会传播到执行上下文；worker 在 finally 中释放本任务的编译产物租约；同账号同源码的成功编译可在最多 16 项前台、2 项后台、5 分钟缓存中复用，过期、淘汰、故障与停机时删除。执行器的 10 分钟 TTL 仍是崩溃兜底。

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

### 首次提交：预编译固定 JSON 运行时

C++ 驱动原先每次提交都重新生成平台 JSON 解析、序列化和 `std::variant` 拷贝/析构代码。现在把这些与学生代码无关的部分编译为只读静态库，提交仍使用相同的 C++20、`-O2 -pipe` 编译学生代码，再链接该库。没有减少测试点，也没有合并学生进程或改变单测试资源限制。

标准源文件在 `deploy/oj/cpp-json-v1/`，全量 Dockerfile 和 `Dockerfile.json` 增量镜像均调用 `build-cpp-json.sh`。头文件与库来自同一次构建，分别安装到 `/usr/local/include/cswork/json-v1.hpp`、`/usr/local/lib/cswork/libjson-v1.a`；`/usr` 在沙箱内只读。`v1` 为不可变 ABI，后续改变实现或类型布局必须使用新版本路径和宏，不能覆盖旧版本资产。

生成代码在学生源码之前定义 JSON 类型，避免学生宏改变静态库 ABI。图结构转换仍在学生源码之后，兼容自定义节点类型。新 worker 仅在固定头文件和静态库同时存在时启用链接；旧镜像自动使用从同一份标准源码内嵌的实现。原始 ACM 编译命令不变。完整内嵌实现保留在生成代码中，运行时源码变化会改变编译缓存键。

部署必须先暂停队列派发、等待在途判题结束，再停 worker、切换已验证的镜像并重启 worker，清除旧 runner 的可执行文件缓存；最后恢复队列。镜像回滚同样需要重启 worker。验收脚本实际链接版本化头文件与静态库并检查数值、Unicode 和嵌套 JSON 往返，不能仅以文件存在判定部署成功。

2026-09-06，在相同服务器、相同候选镜像上比较旧驱动与新驱动；同一份正确 C++ 代码、同一份输入、相同输出检查器、每测试独立沙箱：

|范围|旧驱动首次|新驱动首次|旧驱动缓存|新驱动缓存|
|---|---:|---:|---:|---:|
|Two Sum 的三个原题公开样例|2497 ms|1599 ms|153 ms|142 ms|
|Maximum Subarray 的完整 31 测试|3441 ms|2538 ms|1283 ms|1256 ms|

表中包含编译、bridge、全部测试及输出校验，不含生产排队、公网与浏览器。新驱动配旧镜像的回退路径亦全部通过：三个样例首次2544 ms、缓存136 ms；31测试首次3496 ms、缓存1263 ms。以上是单轮对照，耗时会随机器负载变化。

用户已登录的本地 Chrome 上，LeetCode Two Sum 相同解法重复运行三个公开样例，点击至结果实测约1508、1726、1959 ms（包含自动化命令开销，LeetCode 缓存行为未知）。它是样例运行结果，不能用于宣称本站完整隐藏测试已达到相同速度。正式判题体验需额外测量线上点击至最终 Accepted；界面展示的运行毫秒数仅是执行指标。

### 编辑停顿后的低优先级预编译

已登录学员编辑非空、非模板 C++ 草稿，停笔2500ms且页面可见时，前端调用独立预编译接口。同用户同页面至少12秒一次，连续编辑保留最新草稿尾随发送；queued回执只做30秒去重，不代表服务器已经完成编译。运行、提交、隐藏、切题及卸载会清除浏览器待发任务。失败不自动循环重试，其他语言保持原流程。

API复用题目发布、题库验证与评测访问规则（题库/OA 对已验证账号免费，课程练习看课程授权），仅读取编译需要的题目规格，不读取隐藏测试；每用户6次/分钟，独立于正式提交额度。SQLite信箱每用户最多1条、全站32条、30秒有效期，以generation条件删除防止旧编译清掉新草稿。worker的维护周期清理过期请求，不创建submissions、oj_outbox或学习记录。

同一worker最多执行1个后台编译，8秒超时；存在正式任务时不启动后台，正式任务进入时同步占位并取消、等待后台退出。仍使用go-judge隔离环境，编译缓存key为用户、语言及完整包装源码。8个正式缓存与2个预编译缓存预算独立；后台只替换旧后台缓存，正式命中时晋升并遵守正式缓存上限，活跃租约不被驱逐。失败、取消或源码变化都不能冒充成功编译，更不会缓存AC结果。设置 `OJ_PRECOMPILE_ENABLED=false` 可停止新后台任务。

真实g++取消探针：编译开始约251ms后取消；HTTP在3ms后中止，53ms内检查原g++/cc1plus/as PID均已消失；同源码预编译1320ms后正式acquire1ms且总共只调用一次编译器。这里53ms包含25ms轮询与进程检查开销，不是所有程序的固定取消时限。worker日志仅记录预编译结果、编译缓存命中和耗时，不记录草稿源码。

### Java、Go 与 Python 的反馈延迟

C++、Java、Go 共用停笔预编译入口、每用户请求预算和两条后台缓存额度。信箱显式保存语言；去重键、包装驱动和编译器均使用该语言，切换语言不会复用另一种语言的产物。迁移0011为旧信箱行补默认cpp。部署及自动回滚会清空短期信箱；使用旧版安装器手动回滚时，也须在停止worker后清空 `oj_precompile`，不要删除正式submissions或outbox。

Python保留原解释器、可用模块和每测试隔离。实测完整28测试的语法检查只占约47ms，总计1059–1097ms；为这几十毫秒额外发送草稿没有明显收益，因此不做后台预编译，也不改变Python用户代码的运行环境。

Go镜像通过 `deploy/oj/build-go-cache.sh` 在镜像构建时执行固定工具链的 `go build -trimpath std`（CGO关闭），将可信标准库对象放入 `/usr/local/lib/cswork/go-stdlib-cache-v1`。标记文件记录工具链、架构和构建参数；只在完整构建成功后写入。该目录在sandbox内属于只读/usr，不能被学员修改。新主包和缓存未命中的导入仍由Go在独立sandbox内编译；没有标记的旧镜像使用原来的 `/tmp/go-cache`，不影响正确性。Go自身的构建缓存键区分源码、工具链和构建参数（[官方说明](https://pkg.go.dev/cmd/go#hdr-Build_and_test_caching)）。

同一服务器、相同Two Sum完整28例、相同隔离和2用例并发，直接runner测试：

|语言/路径|编译|完整28例|合计|
|---|---:|---:|---:|
|Go 原空标准库缓存|6824ms|1088ms|7913ms|
|Go 只读标准库缓存|274ms|约1098ms|1372ms|
|Go 草稿已预编译|缓存命中|约1094ms|1094ms|
|Java 首次|1363ms|2499ms|3862ms|
|Java 编译已缓存|约1ms|2417ms|约2418ms|
|Python 首次|47ms|1012ms|1059ms|

以上不含生产排队、公网或浏览器呈现。Java的剩余耗时主要来自每测试独立启动JVM及驱动，不能把缓存编译后的数据等同于所有语言都达到相同反馈时间。默认SerialGC已经启用；禁用PerfData、替换jar打包的对照未证明足够收益，保留原配置和正常JIT。

Go候选镜像原生验证：`GO_JUDGE_URL=http://127.0.0.1:5052 python3 tests/go-readonly-cache.integration.py`（从服务器私有OJ环境读取token，勿在输出中显示）。验证新主包、额外gzip/sha256/png标准库导入、编译错误与只读写入拒绝；164MiB缓存前后完整摘要相同。候选基于原镜像增量构建，不修改go-judge二进制、隔离策略、资源限额或已验证的C++运行库。

### 防止结果保存争用引起整题重试

2026-09-06多语言线上验收中，一次Python提交完成23/28测试后重新排队，浏览器总耗时6087ms。服务没有重启，runner正常响应；独立worker与数据库副本复现中，另一SQLite连接每10ms更新无关小表，第1次提交即捕获 `SqliteError / SQLITE_BUSY`。默认DEFERRED事务先读取当前attempt再写测试结果，在其他连接持写锁或已提交更新时，可能无法升级为写事务；busy_timeout无法替该读后升级过程正常排队。

逐例持久化现在由 `persistCase` 使用IMMEDIATE事务：先取得写锁，再核验当前attempt/取消状态，原子写入用例与汇总进度。没有改变判题、case顺序、隐藏输出、公开输出限长和时间/内存单位。新增受限错误类型和code日志，不记录异常消息、SQL参数、源码或测试内容。其他临时故障仍保留有界重试，持续写锁超过5秒超时也不保证成功。

回归验证直接调用真实持久化函数并使用另一SQLite线程持写锁：原DEFERRED失败，IMMEDIATE通过，保留已有23个结果、attempt不增加；取消/旧attempt拒写、进度更新失败整笔回滚、隐藏输出及公开限长均通过。相同10ms写入压力下，真实worker连续10次Python提交全部28/28、attempt=1，无错误和重试，耗时1138–1291ms（不含浏览器）。
