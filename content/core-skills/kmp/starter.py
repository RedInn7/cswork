def prefix_function(p: str) -> list:
    """前缀函数 / pi[i]: longest proper prefix of p[0..i] that is also its suffix."""
    return [0] * len(p)  # TODO


def find_all(t: str, p: str) -> list:
    """KMP 匹配 / Every start index of p in t, overlaps included, in O(|t| + |p|)."""
    return []  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    t, p = sys.stdin.read().split()
    found = find_all(t, p)
    print(" ".join(map(str, prefix_function(p))))
    print(len(found))
    print(" ".join(map(str, found)) or -1)


main()
