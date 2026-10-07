import sys

def solve(raw):
    it = iter(map(int, raw.split()))
    n = next(it)
    values = [next(it) for _ in range(n)]
    children = [(next(it), next(it)) for _ in range(n)]
    order = [0]
    for u in order:
        left, right = children[u]
        if left != -1:
            order.append(left)
        if right != -1:
            order.append(right)
    gain = [0] * n
    direction = [-1] * n
    best = None
    center = 0
    for u in reversed(order):
        left, right = children[u]
        lg = gain[left] if left != -1 and gain[left] > 0 else 0
        rg = gain[right] if right != -1 and gain[right] > 0 else 0
        through = values[u] + lg + rg
        if u == 0:
            best, center = through, u
        if lg >= rg and lg > 0:
            direction[u] = left
            gain[u] = values[u] + lg
        elif rg > 0:
            direction[u] = right
            gain[u] = values[u] + rg
        else:
            gain[u] = values[u]
    left, right = children[center]
    path = []
    if left != -1 and gain[left] > 0:
        u = left
        while u != -1:
            path.append(u)
            u = direction[u]
    path.reverse()
    path.append(center)
    if right != -1 and gain[right] > 0:
        u = right
        while u != -1:
            path.append(u)
            u = direction[u]
    return (str(sum(values)) + '\n' + str(best) + '\n'
            + ' '.join(str(values[u]) for u in path) + '\n'
            + ' '.join(map(str, path)) + '\n')

if __name__ == '__main__':
    sys.stdout.write(solve(sys.stdin.buffer.read()))
