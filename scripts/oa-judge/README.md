# OA 评测内容生成

## 来源完整性

不要仅凭整理后的 MDX/catalog 判断题干缺失。上游 `parse_fastprep.py` 使用 `<[^>]+>` 删除 HTML，会把数学比较式中的 `<` 连同后续正文吞掉。先核对 catalog 对应提交的 `fastprep/<Company>/*.md` 原始快照，逐题读正文与完整约束；不得执行来源仓库中的题解或脚本。

恢复出的规则单独记录提交、原文件路径、Git blob 和既有 catalog 指纹，见 `content/oa-judge/source-evidence/restored-raw-statements.json`。不要悄悄重写已发布内容的来源哈希。原文件本身仍有歧义时继续暂缓；本站输入协议与补充限制必须明说，不能伪称原题规定。

运行 `python3 scripts/oa-judge/google_batch.py` 可重建首批 6 题。只执行此目录中编写的算法，不执行 OA Master 导入的代码。

题目：`oa-google-1`、`oa-google-2`、`oa-google-3`、`oa-google-5`、`oa-google-7`、`oa-google-9`。课程为 `gomall`，章节为 `00-overview`；采用现有 OJ 的标准输入输出协议和 `tokens` 检查器。

## 输出

- `content/oa-judge/packages/`：现有 `OjProblemPackage` 格式，3 个公开样例、至少 28 个隐藏测试。
- `references/`：独立编写的完整 Python 参考程序。
- `editorials/`：中文思路、正确性证明、复杂度和参考代码。
- `oracles/`：每题 163 个输入与独立算法计算的期望输出。
- `mutants/`：每题两个有明确错误的完整程序。
- `negative-controls/`：同一批错误程序的单独 Python 文件，方便复现。
- `validation.json`：确定性本地验证结果，不代表已通过真实评测沙箱。
- `batches/first-google.json`：首批题目来源指纹、与 JavaScript `JSON.stringify` 一致的包校验值、本站题解。生成器不再覆盖主 registry。

## 独立验证方法

| 题目       | 参考算法           | 对照算法                     | 典型错误程序               |
| ---------- | ------------------ | ---------------------------- | -------------------------- |
| 棋盘得分   | 扫描格子和相邻边   | 枚举全部代币对               | 不加奖励；把空格也计分     |
| 零和三元组 | 最早结束区间贪心   | 枚举候选区间的所有子集       | 允许重叠；遗漏最后三元组   |
| 硬币游戏   | 两个计数器         | 用对象列表模拟桌面和钱包     | 负硬币；领奖后不清空       |
| 共同数字   | 十种数字计数       | 枚举所有元素子集并求数字交集 | 同一元素计两次；只看十位   |
| 区间加一   | 正差分之和         | 从全零状态 BFS 枚举区间加一  | 下降也计数；累加所有目标值 |
| 最大三位数 | 按选取长度动态规划 | 枚举长度 1、2、3 的全部组合  | 同一数字重复使用；重排数字 |

每题均有 160 个固定种子的随机小输入，加 3 个公开样例；参考程序的真实标准输入输出逐一与独立算法比较。大边界使用容易人工确认的结构化输入，例如 10 万个交替的 `10⁹,0`，期望值为 `50000 × 10⁹`。不会对大输入运行指数枚举。

输入格式由本站明确整理，不声称是原 OA 平台的原始 I/O。当前六题的算法规则和数值范围有完整来源题面，来源内容哈希随题解记录。原站不完整或有矛盾的题目没有进入这批评测。

本地通过后，仍须由发布流程完成真实沙箱验证，并把包、参考程序、独立对照数据与错误程序的指纹绑定到报告。未通过发布校验的内容不能显示为可提交题目。

## 分批验证与发布

`batches/` 只存题目清单，普通本地验证结果放 `validation/`。添加新批次后执行：

```sh
node scripts/oa-judge/aggregate-batches.mjs
node scripts/verify-oa-judge.mjs --batch google-next
node --import tsx --test tests/oa-judge-content.test.ts
node --import tsx scripts/publish-oa-judge.ts --batch google-next TEACHER_EMAIL
```

真实沙箱地址和鉴权凭证通过环境变量配置，不写入报告或代码。批次报告保存在 `reports/<batch>.json`，绑定本批次及每条题目，新增其它批次不会使既有证据失效。首批兼容原始 `sandbox-report.json`，其文件指纹仍必须匹配。发布者必须是已验证的配置教师；缺失证据、重复 ID、题包或题解变化都拒绝发布。

端到端验收使用 `node tests/oa-judge-integration.mjs google-next`，只写全新临时数据库和独立队列，不接触真实学员数据。

后续批次生成器位于 `batches/google_remaining_a.py`、`amazon_remaining_a.py`、`meta_first.py`，分别对应 `google-remaining-a`、`amazon-remaining-a`、`meta-first`。每批保留逐题审阅结论；无法明确判定正确输出的条目不进入 registry。

沙箱验证支持 `tokens` 和 `exact`，语义必须与生产一致；不允许把异常退出的错误程序算作有效反例。元数据、代码、输入输出或对照文件变更后，必须重新生成并验证相应批次报告，不能手工改报告指纹。

发布前执行 `node scripts/oa-judge/coverage.mjs`，统计表同时校验真实文件哈希、通过数量、独立输入数量与全部错误程序名称。`sandbox_verified` 只表示报告有效，是否线上可提交仍由已发布数据库版本与 registry 校验值共同决定。
