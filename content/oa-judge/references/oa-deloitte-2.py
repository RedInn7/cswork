import sys

def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        return ""
    n = data[0]
    if not 1 <= n <= 200_000 or len(data) != n:
        raise ValueError("expected n and n-1 parent IDs")
    children = [[] for _ in range(n)]
    for node in range(1, n):
        parent = data[node] - 1
        if not 0 <= parent < n or parent == node:
            raise ValueError("invalid parent ID")
        children[parent].append(node)

    # Iterative traversal supports a 200,000-node chain without recursion.
    order = []
    stack = [0]
    seen = bytearray(n)
    seen[0] = 1
    while stack:
        node = stack.pop()
        order.append(node)
        for child in children[node]:
            if seen[child]:
                raise ValueError("parent relation is not a rooted tree")
            seen[child] = 1
            stack.append(child)
    if len(order) != n:
        raise ValueError("all nodes must be reachable from root 1")

    subtree_size = [1] * n
    balanced_count = 0
    for node in reversed(order):
        expected = None
        balanced = True
        for child in children[node]:
            size = subtree_size[child]
            subtree_size[node] += size
            if expected is None:
                expected = size
            elif size != expected:
                balanced = False
        if balanced:
            balanced_count += 1
    return str(balanced_count)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
