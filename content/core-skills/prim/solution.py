def prim(n: int, w: list) -> list:
    """O(n²) Prim / Nodes (0-based) in the order they join the tree from node 0; fewer than n if disconnected."""
    inf = float("inf")
    key, in_tree, order = [inf] * n, [False] * n, []
    key[0] = 0
    for _ in range(n):
        u = -1
        for v in range(n):
            if not in_tree[v] and key[v] < inf and (u < 0 or key[v] < key[u]):
                u = v
        if u < 0:
            break
        in_tree[u] = True
        order.append(u)
        row = w[u]
        for v in range(n):
            if not in_tree[v] and row[v] > 0 and row[v] < key[v]:
                key[v] = row[v]
    return order


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = list(map(int, sys.stdin.buffer.read().split()))
    n = data[0]
    w = [data[1 + i * n:1 + (i + 1) * n] for i in range(n)]
    order = prim(n, w)
    if len(order) != n:
        print(-1)
        return
    # Each node joined through its lightest edge to the nodes before it.
    total = sum(min(w[u][v] for u in order[:k] if w[u][v] > 0) for k, v in enumerate(order) if k)
    print(total)
    print(" ".join(str(v + 1) for v in order))


main()
