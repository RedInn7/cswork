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
