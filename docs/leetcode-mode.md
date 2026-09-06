# LeetCode 与 ACM 提交

精选 500 题默认打开 LeetCode 模式，其他课程题继续使用 ACM。模板来自导入时保存的 LeetCode `codeSnippets`，不根据测试输入的 metadata 猜函数类型。第 1644 题的来源未提供 Go snippet，其 Go 接口按同题的三个节点参数与返回节点接口补齐。

每位学员、每道题、每种语言和模式各有独立草稿。旧版草稿只在 ACM 模式恢复。提交保存原始代码、`coding_mode`、判题版本和 `harness_version`；请求幂等标识不能跨模式复用。历史记录显示原提交模式，恢复历史代码会一并切换模式。

LeetCode 模式沿用原有已验证的测试用例和 checker。Python 驱动使用已审查的输入解析、节点转换与结果适配代码。C++、Go、Java 编译后，由同一 go-judge 沙箱中的 Python 驱动通过 JSON 节点图调用，结果和变异后的参数回传时保留节点身份。设计类整条操作序列一次执行，不为每次方法调用创建进程。297/449 继续分别在两个独立沙箱执行序列化和反序列化。

用户代码及驱动只在 go-judge 内执行，编译和整个执行进程树均沿用既有资源限制。参考答案、候选用例、驱动源码不随题目接口返回。公开接口只返回编辑模板与自定义输入说明。

自定义输入每行一个 JSON 参数。设计题使用两行：操作名数组、参数数组。Codec 输入一行层序树数组。节点目标值、共享链表等使用题目特定的转换规则；430 的多级链表需要显式节点表，编辑器提供对应说明。

修改任何驱动后运行 `python3 scripts/leetcode-mode/export.py`，重新生成公开模板与适配资产。资产含 native 驱动源码摘要，提交绑定整个资产的 SHA-256。部署时 worker 先停止，防止新旧驱动混用；若排队提交的驱动版本已变化，保留代码并提示重新提交。

验证包括 `tests/coding-mode.test.ts`、`tests/leetcode-workspace-ui.test.mjs`、`tests/oj-library-gate.test.ts` 和 `scripts/leetcode-mode/test_runtime.py`。真实 HTTP/worker 测试位于 `tests/leetcode-mode-http.mjs`，只能针对空的独立测试数据库和测试专用队列运行。

C++ LeetCode 模板从类定义开始，标准库头文件、命名空间和节点声明由判题与 clangd 隐藏上下文补齐。clangd 使用 forced include，编辑器正文与诊断行号不变；ACM 仍由学员管理头文件。未修改的旧普通 C++ 模板自动精简，已有解答完整保留。修改语言服务 entrypoint 后需发布对应容器镜像并更新 CSWORK_LSP_IMAGE，再部署 broker 和 web。
