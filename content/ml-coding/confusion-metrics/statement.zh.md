# 混淆矩阵与 Precision / Recall / F1

多分类模型在 n 个样本上给出了预测，类别编号是 0 到 k - 1。不调 sklearn，用 numpy 实现两个函数：

- `confusion_matrix(y_true, y_pred, k)`：返回 k×k 的混淆矩阵，`cm[i][j]` 是**真实类别为 i、预测为 j** 的样本数（行是真实，列是预测）。
- `precision_recall_f1(cm)`：从混淆矩阵算出每一类的 precision、recall、F1，再给出 macro-F1 和 accuracy，按 `(precision, recall, f1, macro_f1, accuracy)` 返回，前三项是长度为 k 的数组。

对类别 c：TP 是 `cm[c][c]`；precision = TP / 预测为 c 的样本数（第 c 列之和）；recall = TP / 真实为 c 的样本数（第 c 行之和）；F1 = 2·P·R / (P + R)。**分母为 0 时，这一项记 0**（和 sklearn 的 `zero_division=0` 相同）。macro-F1 是 k 个类别 F1 的算术平均，**没出现过的类别也算在内**；accuracy 是对角线之和除以 n。

## 输入

第一行是 n 和 k。第二行是 n 个真实类别，第三行是 n 个预测类别，都是 0 到 k - 1 的整数。

1 ≤ n ≤ 2×10^4，2 ≤ k ≤ 20。

## 输出

驱动代码先输出数字个数，再依次输出：混淆矩阵（按行展开，k² 个数）、k 个 precision、k 个 recall、k 个 F1、macro-F1、accuracy，每个保留 6 位小数。与标准答案的相对或绝对误差不超过 10⁻⁵ 即可。

## 样例说明

真实为 [0, 0, 1, 1, 1, 2, 2, 2]，预测为 [0, 1, 1, 1, 2, 2, 0, 2]。混淆矩阵的三行是 [1, 1, 0]、[0, 2, 1]、[1, 0, 2]。类别 0 被预测了 2 次、对了 1 次，precision = 0.5；真实有 2 个、找回 1 个，recall = 0.5。类别 1 和 2 的 P、R 都是 2/3。macro-F1 = (0.5 + 2/3 + 2/3) / 3 ≈ 0.611111，accuracy = 5/8 = 0.625。

## 提示

- 混淆矩阵可以用 `np.add.at(cm, (y_true, y_pred), 1)` 一次累加；直接写 `cm[y_true, y_pred] += 1` 是错的，重复的下标只会加一次。
- 第 c 列之和是「预测为 c」的数量，第 c 行之和是「真实为 c」的数量，别弄反。
- 先把 cm 转成浮点数，分母为 0 的情况再用 `np.divide(a, b, out=np.zeros_like(a), where=b > 0)` 处理，避免除零警告和 NaN。
