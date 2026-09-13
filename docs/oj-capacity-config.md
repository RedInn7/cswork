# 四核主机的评测容量配置

默认：两个普通提交可同时处理（由 worker 控制），runner 提供 4 个执行槽位和 4 个预热沙箱，共享最多 3 核 CPU。槽位不是独占物理核心；worker 保留最多 1 核，网页等服务仍共享整机。是否足够快必须看完整提交压测，而不是只看 CPU 上限。

在 Docker Compose 的环境文件中可调整：

| 参数 | 默认 | 用途 |
| --- | --- | --- |
| `OJ_RUNNER_PARALLELISM` | 4 | 只允许 1、2、4；执行槽位和预热数量一起调整 |
| `OJ_RUNNER_CPUS` | 3 | 容器 CPU 上限；四核机器不要默认给满 4 核 |
| `OJ_RUNNER_GOMAXPROCS` | 3 | runner 的 Go 调度并行度，与 CPU 预算配套 |

4 GiB 内存、无 swap、进程数限制和隔离配置不变。普通题单次执行最多 512 MiB，编译最多 1 GiB；两个普通提交最多同时有两个编译，或四个普通测试点。大快照/高内存任务需要 worker 独占准入，不能只增加 BullMQ 并发。

## 更新 runner，不重建语言工具链

已有同版本、已核验的 runner 镜像时，使用 `Dockerfile.capacity` 仅替换入口脚本：

```sh
docker build -f deploy/oj/Dockerfile.capacity \
  --build-arg BASE_IMAGE=<已核验的本地镜像ID或digest> \
  -t cswork-go-judge:1.12.3-seccomp-capacity4 deploy/oj
```

先暂停并排空评测队列，再使用新 compose 重建 sandbox，核验健康检查和参数，最后恢复队列。保留旧镜像及旧 compose 用于回退。`Dockerfile.capacity` 不适合跨工具链版本更新；全新安装继续使用完整 Dockerfile。完整重建也使用新标签 `cswork-go-judge:1.12.3-seccomp-capacity4`，与 compose 保持一致。

对照测试分别记录排队时间、反馈 P50/P95、单位时间完成数，以及 sandbox cgroup 的 CPU 累计时间/墙钟时间、节流时间和网页响应时间。不要把本机配置检查当作线上容量验证。

## 本次无数据库变更的发布

`deploy/oj-capacity-release.sh <新提交SHA> <线上基准SHA> <已测worker绝对路径>` 仅适用于已经审查确认不改变网页、依赖或数据库结构的 worker 更新。先核对基准与变更范围、构建文件的 SHA-256，再运行。它复制旧发布的网页和依赖，仅替换 worker，记录 `RELEASE_KIND` 和基准 SHA；不执行迁移，也不改动或删除现有数据库备份。完整更新仍使用原有 `deploy/install.sh` 的备份与迁移流程。

发布会拒绝原本已暂停的队列，排空正在评测的任务，再切换 runner/worker。失败恢复旧容器、配置与发布目录；只有 runner 健康且 worker 出现新的健康心跳后才恢复队列。旧 runner 停止保留用于回退，不占运行内存。网页服务不重启。

并发开关 `OJ_WORKER_CONCURRENCY` 只接受 1 或 2，默认 2。快照大于 8 MiB、输出上限大于 8 MiB，或执行内存上限大于 512 MiB 的提交独占 worker，FIFO 等待可取消。此限制保留原来的大任务单提交内存边界，并非允许任意数量大任务并行。
