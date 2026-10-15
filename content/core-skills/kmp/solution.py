def prefix_function(p: str) -> list:
    """前缀函数 / pi[i]: longest proper prefix of p[0..i] that is also its suffix."""
    pi = [0] * len(p)
    for i in range(1, len(p)):
        j = pi[i - 1]
        while j > 0 and p[i] != p[j]:
            j = pi[j - 1]
        if p[i] == p[j]:
            j += 1
        pi[i] = j
    return pi


def find_all(t: str, p: str) -> list:
    """KMP 匹配 / Every start index of p in t, overlaps included, in O(|t| + |p|)."""
    pi, out, j = prefix_function(p), [], 0
    for i, c in enumerate(t):
        while j > 0 and c != p[j]:
            j = pi[j - 1]
        if c == p[j]:
            j += 1
        if j == len(p):
            out.append(i - j + 1)
            j = pi[j - 1]
    return out


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    t, p = sys.stdin.read().split()
    found = find_all(t, p)
    print(" ".join(map(str, prefix_function(p))))
    print(len(found))
    print(" ".join(map(str, found)) or -1)


main()
