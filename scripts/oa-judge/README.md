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

`batches/` 只存已有真实沙箱报告的题目清单。尚待沙箱的候选题清单必须放在 `candidate-batches/`：coverage 会校验其题包、参考程序、独立 oracle、错误程序和本地验证记录并标为 `awaiting_sandbox`，但它们不会进入运行时 registry，也不会向学员开放题解或提交。只有真实沙箱验证通过后，才可将候选清单提升为正式 batch 并生成独立 report。普通本地验证结果放 `validation/`。添加正式批次后执行：

```sh
node scripts/oa-judge/aggregate-batches.mjs
node scripts/verify-oa-judge.mjs --batch google-next
node --import tsx --test tests/oa-judge-content.test.ts
node --import tsx scripts/publish-oa-judge.ts --batch google-next TEACHER_EMAIL
```

真实沙箱地址和鉴权凭证通过环境变量配置，不写入报告或代码。批次报告保存在 `reports/<batch>.json`，绑定本批次及每条题目，新增其它批次不会使既有证据失效。首批兼容原始 `sandbox-report.json`，其文件指纹仍必须匹配。发布者必须是已验证的配置教师；缺失证据、重复 ID、题包或题解变化都拒绝发布。

端到端验收使用 `node tests/oa-judge-integration.mjs google-next`，只写全新临时数据库和独立队列，不接触真实学员数据。

后续批次生成器位于 `batches/google_remaining_a.py`、`amazon_remaining_a.py`、`meta_first.py`、`akuna_rubrik_next.py`，分别对应 `google-remaining-a`、`amazon-remaining-a`、`meta-first`、`akuna-rubrik-next`。每批保留逐题审阅结论；无法明确判定正确输出的条目不进入 registry。Akuna/Rubrik 候选先做离线 oracle 与错误程序验证，必须等真实 GoJudge 报告后才可晋级；Akuna #14 和 #21 因原题例子与规则冲突而明确阻塞。

`python3 scripts/oa-judge/batches/ibm_capital_one_next.py` 生成 IBM #55 与 Capital One #15 的离线候选 `ibm-capital-one-next`。IBM #31 因原样例答案与题意计算冲突、#34 因 DNS cache 命中/淘汰语义多解而暂缓；候选生成器不会更新正式 registry，也不代表通过 GoJudge。

`python3 scripts/oa-judge/batches/roblox_next.py` 生成 Roblox #2、#3、#5、#9、#10、#12、#13 的离线候选 `roblox-next`，每题附独立 oracle、两个正常退出 mutant 和明确的本站输入/边界约定。原始题源路径与 Git blob 记录在 `source-evidence/roblox-next.json`；#1、#4、#6、#7、#8、#11、#14、#15、#16 因源题矛盾或信息缺失保持 blocked。候选不得加入正式 registry，也未做 GoJudge 验证。

`python3 scripts/oa-judge/batches/paycom_next.py` 只将 Paycom #2、#4、#6、#15 的原始代码追踪题参数化为可编程 I/O 候选 `paycom-next`，并记录全部 20 个原始题源 blob。其余固定概念选择题未伪装成代码题；#7 的 DELETE 成功码依赖服务端语义，#20 未指明声明/定义所属语言，均明确 blocked。候选未进入正式 registry，也未做 GoJudge 验证。

`python3 scripts/oa-judge/batches/deshaw_next.py` 生成 The D. E. Shaw Group 候选批次 `deshaw-next`：收录 #3、#5、#6、#8、#10、#11、#12。每题有 163 组独立 oracle、边界样例和两个正常退出错误程序；固定原始快照路径、Git blob、catalog 指纹及逐题审查见 `source-evidence/deshaw-next.json`。#1/#4/#7 因原始规则或约束缺失而 blocked，#2 因文字结果与原图答案冲突而 blocked，#9 在固定 raw 快照中找不到原始题面。#8 是与 #2 同义但有独立可复算样例的唯一收录版本。所有题仅为离线候选，未进入正式 registry，也未做 GoJudge 验证。

沙箱验证支持 `tokens` 和 `exact`，语义必须与生产一致；不允许把异常退出的错误程序算作有效反例。元数据、代码、输入输出或对照文件变更后，必须重新生成并验证相应批次报告，不能手工改报告指纹。

发布前执行 `node scripts/oa-judge/coverage.mjs`，统计表同时校验真实文件哈希、通过数量、独立输入数量与全部错误程序名称。`sandbox_verified` 只表示报告有效，是否线上可提交仍由已发布数据库版本与 registry 校验值共同决定。
