import numpy as np


def tfidf_matrix(docs: list) -> np.ndarray:
    """N×V 的 TF-IDF 矩阵，每行 L2 归一化；列的顺序随意。
    The N×V TF-IDF matrix with L2-normalized rows; columns in any order.
    tf = 词在文档里出现的次数 / the term's count in the document; idf = ln((1 + N) / (1 + df)) + 1."""
    return np.zeros((len(docs), 1))  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    n, q = int(data[0]), int(data[1])
    at, docs = 2, []
    for _ in range(n):
        length = int(data[at])
        docs.append(data[at + 1:at + 1 + length])
        at += 1 + length
    pairs = [(int(data[at + 2 * k]), int(data[at + 2 * k + 1])) for k in range(q)]
    m = np.asarray(tfidf_matrix(docs), dtype=float)
    out = [float(m[i] @ m[j]) for i, j in pairs] + [float(row.max()) for row in m]
    print(len(out))
    print(" ".join("%.6f" % v for v in out))


main()
