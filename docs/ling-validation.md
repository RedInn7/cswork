# 灵神题单判题数据验证

题单目录和可判题状态独立。本工具为 3、11、35、53、69、121、198、209、322、1456 创建可复现的候选数据；只有当前 go-judge 沙箱验证通过后才生成正式包和发布清单。704 不在当前本地题单中，未冒充题单成员导入。

题号与问题身份来自 LeetCode；题单作者为灵茶山艾府（endlesscheng）。验证所用参考解来自用户本地 doocs/leetcode 副本。cswork 的双语摘要、标准输入输出说明和测试数据为本次独立编写，并非 LeetCode 官方测试集。每题原站中英链接、参考文件路径与 SHA-256 保存在私有 manifest。参考解、答案和完整隐藏数据保留在 `.local/ling-verified-packages`，不要放到公共静态目录或学生 API。

## 生成与验证

```sh
python3 scripts/ling-validation/generate.py \
  --references '/path/to/local/doocs/solution' \
  --list '/path/to/ling_problemset.json' \
  --out .local/ling-verified-packages
python3 -m unittest discover -s scripts/ling-validation -p 'test_*.py'
```

生成器只读取下载的 Python 源码并拼接明确签名的 stdin 包装，绝不在宿主导入、执行下载代码。每题含公开样例、边界、24 个固定种子随机、2–3 个上限规模测试，总数小于 64；另外生成 120 个独立小样本暴力答案。种子为 20260905 加题号。

将生成的私有目录和 `verify.py` 复制到具有现有 go-judge 的服务器，再在注入 `GO_JUDGE_URL` 与 `GO_JUDGE_TOKEN` 的受限环境运行：

```sh
python3 verify.py --data /private/path/ling-verified-packages \
  --source-hashes /private/path/ling-source-hashes.json
```

验证工具串行请求 `/run`，每次 Python 进程限制 2 CPU 秒、6 秒墙钟、256 MiB 内存、16 进程，不在宿主运行标准解。启动时必须提供源题快照 `{ "lc-N": "64位小写十六进制 content_hash" }`，缺失或格式错误会拒绝验证。它在运行前冻结源题快照、候选包、参考包装、oracle 和错误实现文件的字节 hash，结束前逐个核对未变，再将冻结字节写入正式包；发布清单绑定 `sourceContentHash`。它检查源码/数据 hash，运行每个正式用例、批量对拍至少 120 个独立 oracle，以及错误常量输出和每题一个常见错误算法的拒绝检查。实际 oracle 参数与答案必须非空、等长、至少 120 条且与声明一致；正式点数必须与声明一致并在 2–64 条之间。只有错误程序正常运行却给出错误答案，才记为拦截成功，编译/运行崩溃不算算法验证。发布清单包含错误实现的 `mutationSha256` 和实际计数，不接受旧的仅常量负控报告。HTTP/沙箱失败不会被标记为通过。`verification-report.json` 保存当前运行结果、时耗和内存；全题通过后产生 `verified-manifest.json` 供发布程序核对。

候选文件后缀为 `.candidate.json`。单题所有检查通过才复制为 `lc-N.json`；发布必须验证最新 `verified-manifest.json` 中 `verified`、数据 SHA-256 和报告，不应仅根据 `lc-N.json` 文件存在就发布。重跑开始会删除旧发布清单，各题验证前删除旧正式包，避免旧通过结果掩盖新失败；仍必须以本次报告为准。

## 分批扩充

新增题目通过 `batches/` 中逐题编写的模块接入。模块声明完整输入约束、标准输入解析、独立小样本 oracle、边界、数学构造的上限答案和常见错误程序；共享生成器不从旧测试集推测答案。普通整数/布尔结果采用严格 token 比较，布尔输出约定为 `0` 或 `1`。树、链表、设计类、多解和浮点题需要相应输入与比较协议，不能直接套用标量模块。

```sh
python3 scripts/ling-validation/generate_batch.py --batch arrays \
  --library .local/ling-library.jsonl \
  --references '/path/to/local/doocs/solution' \
  --out .local/ling-batches/arrays
```

同样支持 `dp`、`graphs` 以及三个系列的 `2`、`3` 批次。每个批次都必须经过上述沙箱验证流程。参考包装器只在沙箱内提高递归深度，保留大连通图压力，并仍受 CPU 和内存限制。生成器执行前清除旧清单，全部生成成功后才写入本次清单。

第 1416 题的首选本地来源没有实现，第 2466 题的首选递归实现不满足沙箱上限，已逐一审查第二来源 kamyu104/LeetCode 的迭代实现。`dp3` 需显式传入 `--secondary-references '/path/to/secondary/Python'`，只会读取代码内明确列出的文件，保留真实路径、hash、MIT 来源与选择理由；不自动试遍实现挑选通过者。Python 2 的 `xrange` 仅在沙箱包装器中别名为 `range`。所有新批次核对原题方法名，难度直接采用题单元数据，防止人工填写漂移。

发布前逐题核对本地题面约束，特别是严格小于、关联参数范围和答案溢出承诺。批次交叉审查与实际沙箱检查缺一不可：参考解与 oracle 一致并不能证明输入合法。曾修正 961 的值域、1009 的严格上界、1287 的值域、1534 的值域及 1492 的 `k≤n` 条件，并在回归测试固定边界。发现已发布的非法数据时，先暂停相关题，再验证修正包并发布新版本，保留旧提交的版本记录。

参考实现有明确失败证据后才人工选择已审查的替代文件。1971 的 DFS 漏记访问状态，309、714 和 1510 的缓存递归在最大输入触发沙箱递归错误；对应改用本地 `Solution2.py` 的 BFS 或迭代 DP，原文件 hash 与原因记录在生成清单和验证报告。包装器保留内建三参数 `pow`，避免数学库的浮点 `pow` 遮盖模幂函数。

`coverage.py` 对完整本地题单逐题登记，可重复传入 `--verified` 合并已通过批次。它核查源题 hash、实际包与验证报告。输出中的 `sandbox-verified` 表示沙箱验证通过，不代表已发布到生产；生产可用数量需要另查数据库当前版本绑定。不得把已生成候选或未覆盖题目计为已完成。

```sh
python3 scripts/ling-validation/coverage.py --library .local/ling-library.jsonl \
  --source-hashes .local/ling-source-hashes.json \
  --verified .local/ling-verified-packages/verified-manifest.json \
  --verified .local/ling-batches/arrays/verified-manifest.json \
  --output .local/ling-coverage.json
```

## 原首批协议

学员编写普通 stdin/stdout 程序，支持 Python、C++、Java、Go。数组使用 `n` 加空格分隔整数；多参数写入第一行；字符串独占一行，题号 3 保留空格和空串。输出均为单个整数，使用精确整数 token 比较，不接受全局数组排序或其他宽松容错。

独立 oracle：最长子串/面积/子数组/股票采用枚举，打家劫舍枚举合法位集合，零钱兑换采用金额图 BFS，平方根小样本逐个整数枚举，滑动窗口逐个窗口计数。上限压力答案按构造规律推导，再由下载参考解在沙箱核验。这样不会仅用同一个参考解同时生成和验证小样本答案。

## 边界

验证证明所列用例与当前 Python 参考解、包装、runner 的一致性；不是整个题单已具备成熟官方数据。尚未做每题多语言标准解对拍、系统错误解变异覆盖或复杂度的形式证明。尤其二分题单次上限输入无法强制区分 O(log n) 和 O(n)，不声称能检测所有复杂度违规。后续扩展应保持逐题验证证据，不将旧 gatecode 的 enabled 标志或历史宽松比较产生的 AC 直接迁移成已验证状态。

## 停用旧数据后的重建

题单导入只保留中英题面和参考解来源，不再读取或接受旧 `testcase-generator` 的输入/答案。新数据仅由本目录自写生成器创建，参考解只在沙箱运行。当前十题重新生成 320 个正式测试点（含零钱兑换 `[1,3,4]`、金额 `6` 的贪心反例）、1200 个暴力对拍样本，另有 10 个常量拒绝检查和 10 个常见错误解检查。运行结果以本次私有报告为准；这些数字不代表其他题目已完成重建。
# 精选题单追加批次

`selected_arrays1`、`selected_windows1`、`selected_dp1`、`selected_inplace1` 共 98 道精选题，沿用独立小规模 oracle、完整合法上限和正常退出的错误程序验证。私有数据与沙箱报告不提交仓库。最大规模失败的递归参考保留原测试，明确改用已审阅的本地迭代版本；选择原因写入生成清单。

原地修改参考仅使用固定转换：有效前缀、完整第一数组、矩阵按行展开、字符数组拼接。转换代码随参考 wrapper 一起绑定哈希，不能上传任意转换代码。`int-multiset` 使用计数行和整数值，忽略顺序但严格保留出现次数；与拒绝重复值的 `int-set` 分开。发布前必须部署支持该规则的 web 和 worker，并通过四语言 HTTP 判题测试。
