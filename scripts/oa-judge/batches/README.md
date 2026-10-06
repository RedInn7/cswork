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
