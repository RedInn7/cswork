# 灵神题单首批判题数据验证

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

验证工具串行请求 `/run`，每次 Python 进程限制 2 CPU 秒、6 秒墙钟、256 MiB 内存、16 进程，不在宿主运行标准解。启动时必须提供源题快照 `{ "lc-N": "64位小写十六进制 content_hash" }`，缺失或格式错误会拒绝验证。它在运行前冻结源题快照、候选包、参考包装和 oracle 的字节 hash，结束前逐个核对未变，再将冻结字节写入正式包；发布清单绑定 `sourceContentHash`。它检查源码/数据 hash，运行每个正式用例、批量对拍 120 个独立 oracle，以及错误常量输出的拒绝控制。HTTP/沙箱失败不会被标记为通过。`verification-report.json` 保存当前运行结果、时耗和内存；全题通过后产生 `verified-manifest.json` 供发布程序核对。

候选文件后缀为 `.candidate.json`。单题所有检查通过才复制为 `lc-N.json`；发布必须验证最新 `verified-manifest.json` 中 `verified`、数据 SHA-256 和报告，不应仅根据 `lc-N.json` 文件存在就发布。重跑开始会删除旧发布清单，各题验证前删除旧正式包，避免旧通过结果掩盖新失败；仍必须以本次报告为准。

## 题目协议和比较

学员编写普通 stdin/stdout 程序，支持 Python、C++、Java、Go。数组使用 `n` 加空格分隔整数；多参数写入第一行；字符串独占一行，题号 3 保留空格和空串。输出均为单个整数，使用精确整数 token 比较，不接受全局数组排序或其他宽松容错。

独立 oracle：最长子串/面积/子数组/股票采用枚举，打家劫舍枚举合法位集合，零钱兑换采用金额图 BFS，平方根小样本逐个整数枚举，滑动窗口逐个窗口计数。上限压力答案按构造规律推导，再由下载参考解在沙箱核验。这样不会仅用同一个参考解同时生成和验证小样本答案。

## 边界

验证证明所列用例与当前 Python 参考解、包装、runner 的一致性；不是整个题单已具备成熟官方数据。尚未做每题多语言标准解对拍、系统错误解变异覆盖或复杂度的形式证明。尤其二分题单次上限输入无法强制区分 O(log n) 和 O(n)，不声称能检测所有复杂度违规。后续扩展应保持逐题验证证据，不将旧 gatecode 的 enabled 标志或历史宽松比较产生的 AC 直接迁移成已验证状态。
