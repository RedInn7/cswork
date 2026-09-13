# OA 题目接入

入口：算法题库 → OA 题目，也可打开 `/?view=problems&library=oa`。原有算法题单和刷题轮次不变。

## 内容与边界

经站点所有者授权，同步自私有 `RedInn7/OA-Master` 仓库，源版本 `e66f809f4c953bce129f68491726176615db6afc`。

- 167 个公司分类，1,634 个原编号条目，4,733 段参考代码。
- 保留题面、讲解、源码、公司归属、原站锚点与内容哈希。支持 Python、Java、C++，以及源中已有的 SQL、CSS、Bash。
- 同一语言有多段代码时分别展示、分别复制，不拼接成一个程序。
- 这是阅读题库，没有经过本站测试数据验证，明确不提供运行、提交或虚构的通过状态。不会放宽现有 LeetCode 发布门禁。
- 3 个原条目没有独立题面、37 个没有独立讲解、43 个没有代码；界面如实提示。题意与参考算法没有在本次同步中整体重写或重新证明。

首页文案的公司/题量是营销概数，本次按仓库的实际公司分类与原编号条目计数；分类可能含同公司的别名。3 个纯介绍段落与目录页不计作题目，原文及所有异常记录在 `content/oa-master/manifest.json`。

## 同步

```sh
node scripts/import-oa-master.mjs /path/to/authorized/OA-Master
```

脚本固定读取公司目录与导航顺序，不执行 MDX、源仓库脚本或参考代码。围栏内的标题不会被切题；不认识的 MDX 结构会阻止导入，而不是静默丢弃。审计清单记录每个源文件 SHA、每行归属、题目数量与异常，便于后续同步复核。

## 访问

沿用当前算法区的登录权限。目录、题面与主动打开的参考解分别通过 `/api/oj/oa-library`、`/{id}`、`/{id}/solution` 获取，均禁止缓存。没有新增公开题面接口，也没有改动原 OA Master 的会员系统。

完整数据作为私有服务端运行文件打包至 `content/oa-master/`，不放进 `public/`、浏览器脚本或初始 HTML。Markdown 不执行原始 HTML/JS；外链仅允许无凭证的 HTTPS，不自动加载外站图片。

## 验证

- `node --test --test-concurrency=1 tests/oa-import.test.mjs`
- `node --import tsx --test --test-concurrency=1 tests/oa-library.test.ts tests/oa-library-ui.test.mjs`
- `OA_MASTER_SOURCE=/path/to/authorized/OA-Master node --test tests/oa-import.test.mjs`：源重建与已提交数据一致性。
- `npm run build && node tests/oa-library-http.mjs`：全新临时数据库中的真实 HTTP 登录保护、分页、题面/题解分离、私有文件不可下载、原算法 API 回归。该测试不使用正式账号、密钥或数据库。
