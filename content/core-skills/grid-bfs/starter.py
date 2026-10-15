from collections import deque


def shortest_path(grid: list) -> int:
    """网格 BFS / Fewest 4-directional steps from S to T, or -1."""
    return -1  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    rows = int(data[0])
    print(shortest_path(data[2:2 + rows]))


main()
