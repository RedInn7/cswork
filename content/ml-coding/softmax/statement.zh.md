# 数值稳定的 Softmax 与 Log-Softmax

神经网络的输出层通常给出一行 logits z，softmax 把它变成概率：softmax(z)ᵢ = e^{zᵢ} / Σⱼ e^{zⱼ}。不调 scipy / PyTorch，对 n×k 矩阵的**每一行**实现：

- `softmax(z)`：逐行 softmax。
- `log_softmax(z)`：逐行 log(softmax(z))。

直接照公式写会出问题：e^{1000} 溢出成 inf，inf / inf 是 NaN；e^{-1000} 下溢成 0，log 0 是 -inf。利用 softmax(z) = softmax(z - c) 对任意常数 c 成立，**先减去每行的最大值**再取指数；log-softmax 要写成 (z - m) - log Σ e^{zⱼ - m}，不能先算出 softmax 再取 log。

## 输入

第一行是 n 和 k。接下来 n 行，每行 k 个实数 logit。

1 ≤ n·k ≤ 2×10^4，logit 的绝对值不超过 10^5。

## 输出

驱动代码先输出 2nk，再输出 softmax 矩阵（按行展开）和 log-softmax 矩阵（按行展开），保留 6 位小数。与标准答案的相对或绝对误差不超过 10⁻⁵ 即可；结果里不能有 NaN 或 inf。

## 样例说明

第一行 [1, 2, 3]：减去最大值 3 得 [-2, -1, 0]，e 的幂是 [0.1353, 0.3679, 1]，和为 1.5032，softmax ≈ [0.090031, 0.244728, 0.665241]，log-softmax = [-2, -1, 0] - ln 1.5032 ≈ [-2.407606, -1.407606, -0.407606]。第二行 [1000, 1000, 999] 直接取指数会溢出，减去 1000 后是 [0, 0, -1]。第三行最小的概率约 e^{-100}，打印成 0，但它的 log-softmax 是精确的 -100。

## 提示

- `z.max(axis=1, keepdims=True)` 保留维度，减法能直接按行广播。
- 减去最大值后每行至少有一个 e⁰ = 1，分母不会是 0，log 的参数也不会是 0。
- log-softmax 用 log(softmax) 计算，在概率小于约 10⁻³⁰⁸ 时会得到 -inf，这正是交叉熵损失要直接用 log-softmax 的原因。
