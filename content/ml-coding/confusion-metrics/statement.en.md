# Confusion Matrix and Precision / Recall / F1

A multiclass model has made predictions for n samples, with classes numbered 0 to k - 1. Without sklearn, implement two functions with numpy:

- `confusion_matrix(y_true, y_pred, k)`: the k×k confusion matrix, where `cm[i][j]` counts samples whose **true class is i and predicted class is j** (rows are truth, columns are predictions).
- `precision_recall_f1(cm)`: per-class precision, recall and F1 from the matrix, then macro-F1 and accuracy, returned as `(precision, recall, f1, macro_f1, accuracy)` where the first three are arrays of length k.

For class c, TP is `cm[c][c]`; precision = TP / the number predicted as c (column c's sum); recall = TP / the number truly c (row c's sum); F1 = 2·P·R / (P + R). **A score whose denominator is 0 is 0** (as with sklearn's `zero_division=0`). Macro-F1 is the plain mean of the k F1 scores, **classes that never occur included**; accuracy is the diagonal's sum over n.

## Input

The first line holds n and k. The second line holds the n true classes and the third the n predicted classes, all integers from 0 to k - 1.

1 ≤ n ≤ 2×10^4, 2 ≤ k ≤ 20.

## Output

The driver prints how many numbers follow, then: the confusion matrix row by row (k² numbers), k precisions, k recalls, k F1 scores, macro-F1 and accuracy, each with 6 decimals. An answer within 10⁻⁵ (relative or absolute) of the expected one is accepted.

## Explanation

The truth is [0, 0, 1, 1, 1, 2, 2, 2] and the predictions [0, 1, 1, 1, 2, 2, 0, 2]. The matrix rows are [1, 1, 0], [0, 2, 1] and [1, 0, 2]. Class 0 was predicted twice and right once, so precision = 0.5; it occurs twice and was found once, so recall = 0.5. Classes 1 and 2 both have P = R = 2/3. Macro-F1 = (0.5 + 2/3 + 2/3) / 3 ≈ 0.611111 and accuracy = 5/8 = 0.625.

## Hints

- np.add.at(cm, (y_true, y_pred), 1) builds the matrix in one call; cm[y_true, y_pred] += 1 is wrong, because a repeated index pair is only added once.
- Column c's sum counts predictions of c and row c's sum counts true c's: do not swap them.
- Turn cm into floats first; then np.divide(a, b, out=np.zeros_like(a), where=b > 0) handles a zero denominator without a warning or a NaN.
