# 灵茶山艾府题单本地导入

`scripts/import-ling-library.py` 使用 Python 标准库生成题库 JSONL 和来源清单。它只读取题单、题面、参考解元数据等白名单来源，不下载题目、不执行参考解、不连接数据库。旧测试数据不可信，因此完全排除 `testcase-generator` 目录，不枚举、不解析、不哈希其中任何文件。

```sh
python3 scripts/import-ling-library.py --source /Users/capsfly/Desktop/gatecode --output .local/ling-library.jsonl
```

输出 `.local/ling-library.jsonl` 和 `.local/ling-library-manifest.json` 是本地数据产物，不提交到 Git。每行一道题，`id` 使用 `lc-<LeetCode题号>`，专题为多对多关系；去重依据 LeetCode 题号，参考解依据 slug 关联，不能使用旧项目数据库的内部 `pid`。

## 来源

- 题单：`leetcode solution/solution 2/ling_problemset.json`。作者灵茶山艾府（endlesscheng），[原始题单](https://leetcode.cn/discuss/post/3141566/ru-he-ke-xue-shua-ti-by-endlesscheng-q3yd/)。本地快照含 12 专题、3,089 个引用、2,542 道唯一题；并非实时更新版本，专题内现有数字顺序不代表作者原始教学顺序。
- 函数签名、语言模板、英文元数据：`fetch_data/leetcode_data/{slug}.json`。
- 中英题面：`leetcode solution/solution 1/solution/*/*/README.md` 与 `README_EN.md`，来自 [doocs/leetcode](https://github.com/doocs/leetcode)，本地 `LICENSE` 为 CC BY-SA 4.0。只提取 `description:start` 至 `description:end`，转换为 Markdown；不包含题解。原题标注 LeetCode 来源，保留原题链接及转换说明。保留该内容的来源、许可与相同方式共享标记；不据此为其他第三方内容重新授权。
- 参考解路径及哈希：同目录的 Python、C++、Java、Go 解；以及 `leetcode solution/solution 2/Python`、`C++` 下 [kamyu104/LeetCode-Solutions](https://github.com/kamyu104/LeetCode-Solutions) 的解。本地 `LICENSE.md` 为 MIT。导入包仅存路径、SHA-256、作者与许可，不包含参考解源码。
- **不导入旧测试数据**：`testcase-generator/` 下的输入、答案、审计与验证报告全部排除。即使文件包含看似正确的答案或通过标记，也不读取、不继承。

来源清单包含题单和每个专题的原链接，以及实际读取的元数据、题面、参考解和许可文件的 SHA-256。题面图片仅转换为绝对 URL 引用，不下载；脚本和样式内容丢弃。段落、列表、代码块、上下标及表格行保留为可读文本或 Markdown。

## 判题状态

新导入快照的 2,542 道题全部输出 `cases: []`、`caseStatus: "missing"`。清单中的候选用例计数始终为零。历史快照曾包含的 38,791 个候选用例不再属于本次导入来源；附有输出或旧验证报告都不能证明正确性。重新生成导入文件不会自动修改已发布的判题版本，部署时还必须撤销旧版本的可提交状态，待重新验证后发布。

旧项目的 `judge_A/B/C_verdicts.jsonl` 是约束合法性审计，不能作为当前平台 AC 证据；旧独立执行报告存在部分语言失败、全部失败及未完成的条目。导入器不继承旧 `judge_enabled`。

开启一道题的站内判题前，需要为其定义可验证的参数编码和输出比较方式，在隔离环境运行参考解、验证公开样例及边界和随机用例，并保存验证版本及参考解哈希。多解、任意顺序、浮点误差、原地修改、设计类、交互式题目必须使用适合题意的适配器或 checker。无法可靠处理的题继续保持未验证状态。

## 部署与重新验证

先迁移数据库，再显式指定目标数据库导入私有 JSONL。第三个参数可导出当前数据库的 canonical source hash，供沙箱验证器绑定本次来源：

```sh
node --env-file=.env scripts/migrate.mjs
node --env-file=.env scripts/load-study-library.mjs /private/ling-library.jsonl /private/ling-source-hashes.json
```

验证器用法见 `docs/ling-validation.md`。通过后用配置在 ADMIN_EMAILS 中、已验证邮箱的老师账号发布：

```sh
node --env-file=.env --import tsx scripts/publish-validated-library.ts /private/ling-verified-packages/verified-manifest.json teacher@example.com
```

发布前核对所有包 SHA-256 和源快照 hash；每题发布为不可变 OJ 版本，逐题提交，失败可续跑。只有源快照和当前正式版本同时匹配，题单才显示已验证。导入幂等，不删除未出现的历史条目；目标库应专用于本题单，不把其他题库混入此表。

题单接口只供已登录用户读取，每页30题；详情按需加载，候选用例和参考解路径不返回给浏览器。站内提交另外要求课程权限。题单按本地专题和题号组织，不还原该快照未保存的原作者小节层级与教学顺序。

## 导入器回归测试

```sh
python3 tests/import-ling-library.test.py
```

使用临时的最小题单验证无旧目录和包含损坏 JSON、伪造答案、重复 slug、诱导执行内容的旧目录产生完全相同的题目输出；另通过拒绝访问的路径守卫确保导入器不枚举或读取旧目录。测试不执行参考解。
