# OA 题目接入

入口：算法题库 → OA 题目，也可打开 `/?view=problems&library=oa`。原有算法题单和刷题轮次不变。

## 内容与边界

经站点所有者授权，同步自私有 `RedInn7/OA-Master` 仓库，源版本 `e66f809f4c953bce129f68491726176615db6afc`。

- 167 个公司分类，1,634 个原编号条目，4,733 段参考代码。
- 保留题面、讲解、源码、公司归属、原站锚点与内容哈希。支持 Python、Java、C++，以及源中已有的 SQL、CSS、Bash。
- 原站题解和代码仅保留在私有源快照，不再由在线题解 API 返回；在线题解为本站独立编写、与已验证程序绑定的版本。
- 通过独立验证的题目接入现有 OJ，使用标准输入输出，支持运行样例、正式提交与首次错误反馈。完整已编写清单见 `content/oa-judge/batches/`；只有匹配验证版本且已发布的题目才显示可练习。其余题标记准备中，不显示提交按钮，不放宽 LeetCode 发布门禁。
- 桌面左侧按公司筛选，可搜索公司、查看收录数量；窄屏切换为原生选择器。列表和做题页均保留明确公司名及 OA 标识。
- 3 个原条目没有独立题面、37 个没有独立讲解、43 个没有代码；界面如实提示。题意与参考算法没有在本次同步中整体重写或重新证明。

首页文案的公司/题量是营销概数，本次按仓库的实际公司分类与原编号条目计数；分类可能含同公司的别名。3 个纯介绍段落与目录页不计作题目，原文及所有异常记录在 `content/oa-master/manifest.json`。

## 同步

```sh
node scripts/import-oa-master.mjs /path/to/authorized/OA-Master
```

脚本固定读取公司目录与导航顺序，不执行 MDX、源仓库脚本或参考代码。围栏内的标题不会被切题；不认识的 MDX 结构会阻止导入，而不是静默丢弃。审计清单记录每个源文件 SHA、每行归属、题目数量与异常，便于后续同步复核。

## 访问

沿用当前算法区的登录权限。目录、题面与主动打开的本站题解分别通过 `/api/oj/oa-library`、`/{id}`、`/{id}/solution` 获取，均禁止缓存；提交继续检查课程授权。没有新增公开题面接口，也没有改动原 OA Master 的会员系统。

完整数据作为私有服务端运行文件打包至 `content/oa-master/`，不放进 `public/`、浏览器脚本或初始 HTML。Markdown 不执行原始 HTML/JS；外链仅允许无凭证的 HTTPS，不自动加载外站图片。

已开放评测的题目，阅读页从同一个已发布版本读取校正版题意、输入输出和公开样例，不再显示源快照中的错误样例。查询限定 `hidden=0`，不会把隐藏测试或解题提示混入题面。

## 2026-09-12 扩展批次

新增 46 份独立编写题包：Google 14、Amazon 15、Meta 17。共 138 个公开样例、1,209 个隐藏测试、7,498 个独立对照输入和 93 个错误程序。对照计数含与公开样例重复的输入，不代表全部互不相同。

原站参考代码未执行。按明确题意重新编写参考解、中文题解和暴力/直接模拟对照；源样例有算术错误时校正，并在逐题审阅记录中注明。不同作者交叉审阅后，再由真实 go-judge 运行同一份展示代码。错误程序必须正常退出且输出错误，崩溃不算有效负控。

Meta7 的空格有语义，使用生产已有的 `exact` 检查器，只统一 CRLF，不去除首尾空格或换行。验证工具与生产检查器有对齐回归。生成器统一 UTF-8 流式解码，防止跨数据块中文损坏。

全量覆盖表：`content/oa-judge/coverage.json`。它区分 `sandbox_verified`、`awaiting_sandbox`、`blocked`、`unreviewed`，不把入库或本地自测当成线上可提交。更新与校验：

```sh
node scripts/oa-judge/coverage.mjs
node scripts/oa-judge/coverage.mjs --check
```

截至 2026-10-07，全量清单共有 1,634 题：1,128 题已通过真实 go-judge 沙箱验证并登记在发布清单；506 题因题面、输出规则或可靠算法尚未解决而阻塞；待审阅为 0。新增的 Google #65、HRT #6、ZipRecruiter #6、Geico #2、Zolostays #1、Intuit #4/#14、Microsoft #45、IBM #31、Rubrik #12、Box #3，以及 Amazon MERN #5（映射到同题 Amazon #34）均已在自有服务器专用 5054 验证沙箱通过，报告保存在 `content/oa-judge/reports/`。**已验证/登记不等于生产数据库已发布**；只有部署版本和数据库中的已发布记录均匹配，题目才可提交评测。

这是滚动清单，数字以 `content/oa-judge/coverage.json` 为准；新增或变更题目后重新生成，避免在文档中沿用旧批次统计。阻塞详情在 `content/oa-judge/reviews/`，题意与判题器尚未厘清前不强行上线。

## 验证

- `node --test --test-concurrency=1 tests/oa-import.test.mjs`
- `node --import tsx --test --test-concurrency=1 tests/oa-library.test.ts tests/oa-library-ui.test.mjs`
- `OA_MASTER_SOURCE=/path/to/authorized/OA-Master node --test tests/oa-import.test.mjs`：源重建与已提交数据一致性。
- `npm run build && node tests/oa-library-http.mjs`：全新临时数据库中的真实 HTTP 登录保护、分页、题面/题解分离、私有文件不可下载、原算法 API 回归。该测试不使用正式账号、密钥或数据库。

评测内容重建和分批命令见 `scripts/oa-judge/README.md`。真实沙箱验证运行 `node scripts/verify-oa-judge.mjs --batch <批次>`，要求传入本机沙箱地址及凭证；正式发布使用 `node --import tsx scripts/publish-oa-judge.ts --batch <批次> <已配置的教师邮箱>`。发布前严格校验源题、题包、展示代码、独立对照数据和错误程序的指纹；脚本通过现有教师发布流程写入新题，不迁移数据库结构。真实 Web/worker 验收见 `tests/oa-judge-integration.mjs`，使用独立队列、全新临时数据库及专用 5054 沙箱。
