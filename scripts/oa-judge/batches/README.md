# 独立批次

`python3 scripts/oa-judge/batches/google_next.py` 生成 Google 第二批 10 题，只写本批次题包、参考程序、对照数据、错误程序、`content/oa-judge/batches/google-next.json` 和 `content/oa-judge/validation/google-next.json`，不会修改线上使用的主 registry 或沙箱验收报告。

每题独立对照 163 次（3 样例和 160 个固定种子随机输入），包内有 3 个公开样例和至少 26 个隐藏测试。第 14 题同时穷举了完整输入域的 37 个数值；随机重复不被表述成 163 个不同输入。

| 编号 | 参考方法 | 独立对照 |
| --- | --- | --- |
| 4 | 下标模 3 分链、计数 | BFS 穷举棋子位置和剩余金币状态 |
| 6 | 迭代二染色、维护极值 | 穷举所有二分组，检查每条边 |
| 8 | 哈希表和最小堆 | 逐次扫描所有已占用柜子编号 |
| 10 | 单调栈 | 枚举全部长度 k 的下标组合 |
| 13 | 枚举零/一/两种配料 | 枚举配料位掩码子集 |
| 14 | 逐位动态规划 | 穷举 0000..9999 的数字和 |
| 16 | 双栈迭代解析 | 生成表达式树时独立计算真值 |
| 18 | 排序与二分 | 逐房屋扫描每个商店 |
| 19 | 频次上限滑动窗口 | 枚举所有连续子数组并重算频次 |
| 20 | 相邻元素最大和 | 枚举所有连续子数组的最小值与最大值 |

结构化大边界的答案直接推导，例如所有值相同的长链树费用为零、10 万个不同访客最后领到第 10 万号柜、全为 9 且全部选取时输出原数字串、2 万层 `add(1,...)` 的结果为 20000。不会用小数据指数算法验证大实例。

跳过了 11（覆盖区间规则与样例冲突）、12（字符格式与样例冲突）、15（连锁引爆解释中的距离判断错误）；具体原因随批次验证报告记录。输入格式由本站明确整理，额外的字符串/编号格式约束不冒充原 OA 约束。

只有主发布流程完成真实沙箱验收并核验内容指纹后，才能把本批次聚合到正式 registry。

`python3 scripts/oa-judge/batches/goldman_sachs_remaining.py` 生成 Goldman Sachs 候选批次 `goldman-sachs-remaining`，仅写入 `candidate-batches/`，不进入正式 registry，也未连接 GoJudge。选入 #9、#10、#16、#17、#21、#22、#23、#25、#29、#31；每题有 163 组参考解/独立 oracle 比对、至少 27 个隐藏用例及两个正常退出 mutant。固定原始快照路径与 Git blob、catalog 内容指纹及 blocked 决策见 `source-evidence/goldman-sachs-remaining.json`；#18 因原样例迷宫输入、输出和解释互相矛盾而 blocked，其余未选题理由见 reviews 文件。

`python3 scripts/oa-judge/batches/misc_companies_remaining.py` 补齐 MesHy、Fortinet、HSBC、WeRide、Agoda、Infosys、Koddi 的剩余审核。当前 9 道进入离线候选（其中 HSBC #1 用 source-bound resolution 修正明显错印的示例值）；每题有 120 个唯一 oracle 输入、30 个正式测试和两个被击杀的正常退出 mutant。其余新审的题按固定题面缺失或矛盾逐题 blocked；已由其它批次审核的题保留既有决定、不重复覆盖。固定上游页 blob、SHA-256、逐题决定和 I/O 补充见 `source-evidence/misc-companies-remaining.json`、`reviews/misc-companies-remaining.json`、`resolutions/misc-companies-remaining.json`。尚未运行真实 GoJudge，不是线上已支持题目。

`python3 scripts/oa-judge/batches/extra_30_review.py` 审核 15 家公司的 30 条题目，只写 `candidate-batches/extra-30-review.json` 和对应候选包、讲义、oracle、mutants、source evidence 与 reviews；不改 coverage、主 registry 或沙箱验收报告。固定 OA-Master 快照为 `e66f809f4c953bce129f68491726176615db6afc`。13 道明确题目各有 120 个唯一 oracle 输入、32 个正式用例及两个正常退出且被击杀的 mutant；另外 17 道逐题给出 blocked 原因。离线验证不代表 GoJudge 已验收。

`python3 scripts/oa-judge/batches/duolingo_flexport5_review.py` 为 Duolingo #3 与 Flexport #5 生成候选题包，并为 Flexport #6 单独记录 blocked 原因。每个候选有 120 个唯一输入、32 个正式用例、独立 oracle 与两个正常退出 mutant；固定上游 MDX blob 和 catalog 指纹记录在 source evidence。Duolingo 来源样例的大小写笔误按规则更正；Flexport #6 需澄清可删除节点的范围。只做离线验证，未调用 GoJudge，不进入 runtime batches 或 coverage。

`python3 scripts/oa-judge/batches/twilio_1_recovered.py` 重写 Twilio #1 的超限参考算法为 Mo 区间查询，只生成 `twilio-1-recovered` 离线候选。203 个独立 brute-oracle 输入、33 个正式用例（含 n=q=100000 压力）和两个正常退出 mutant 本地验证；未连接 GoJudge，也未进入正式批次或 runtime registry。

`python3 scripts/oa-judge/batches/google_29_recovered.py` 为 Google #29 重写最小树直径解法，只生成 `google-29-recovered` 离线候选。2,500 棵小树随机差分、120 个独立穷举 oracle、26 个正式用例和两个被拒绝的错误控制通过；长链/星形各 n=100000 压力测试约 9.3s/1.6s。源约束与 k=0 样例冲突，候选明确修正为 `0≤k<n`。尚未连接目标 GoJudge。

`python3 scripts/oa-judge/batches/amazon_32_recovered.py` 为 Amazon #32 按二分 + LIS 重写参考解，只生成 `amazon-32-recovered` 离线候选。123 个子序列穷举 oracle、33 个正式用例（含重复值、初始无解和 n=100000 压力）及两个错误控制均通过。原题未定义初始 LIS 不达标时的输出；本站明确补充为 `-1`，不称作原题规则。尚未连接目标 GoJudge。

`python3 scripts/oa-judge/batches/visa_7_recovered.py` 按 Visa #7 题面要求的全局 row-major 次序修复上游参考实现的 4×4 子块顺序错误。163 条 oracle、256 个单块穷举、8 个正式用例（含 n=100）及两个错误控制通过。原题没给 n 上限，本站补充 `n≤100` 与 stdin/stdout 协议；尚未连接目标 GoJudge。

以下为新增离线候选，均尚未通过目标 GoJudge，不能视作线上已支持：

| 题目 | 本地验证 | 额外说明 |
| --- | --- | --- |
| Stripe #20 | 120 个独立命令 oracle、300 组高精度坐标对照、7 个正式用例、2 个 mutant | 距离取整边界附近用 Decimal 复算；本站补充命令数、名称与坐标精度限制。 |
| Databricks #26 | 163 个 oracle、14,280 组穷举差分、32 个正式用例、3 个 mutant | 按原题单次交换语义重写；本站补标准 I/O 并明确前导零按整数处理。 |
| Rippling #6 | 1,610 个 oracle、29 个正式用例、2 个 mutant；n=200,000 链/星边界 | 源站第 3 个样例节点数与边数不符，排除且未补造缺失边；本站另设 n 上限。 |
| Confluent #3 | 120 个随机小输入 oracle、11 个正式用例、2 个 mutant；n=40 边界 | meet-in-the-middle；本站明确 n、数值与目标范围。 |
| Confluent #4 | 120 个字符串数组 oracle、7 个正式用例、2 个 mutant | 长度前缀协议保留空行、空格、tab 与 UTF-8 文本；LF 不在单行元素范围内。 |
| SIG #4 | 163 个 oracle、2,055,872 组穷举位置对、33 个正式用例、2 个 mutant；n=100,000 边界 | 按拼接字符串及下标位置对计数，不按数值加法或去重计数；本站明确输入上限。 |
| Goldman Sachs #3 | 120 个唯一随机输入 oracle、10 个正式用例、2 个 mutant；长度 100,000 边界 | Backspace 字符串比较；原长度约束损坏，本站明确补充 `1≤length≤100000`。 |
| Goldman Sachs #14 | 123 个独立排列 oracle、n≤7 的 127 种方向模式、2 个 mutant；n=14 边界 | 按源题严格升降模式最大化绝对差和；源题缺少 N 上限，本站补充 `N≤14`，不额外限制数值范围。 |
| TradeDesk #5 | 120 个独立 oracle、9 个正式用例、2 个 mutant；10 万条航班规模 | 按固定题面与解法的升序时刻和“到达时刻可登机”规则计算旅程；补充标准 I/O 协议。 |
