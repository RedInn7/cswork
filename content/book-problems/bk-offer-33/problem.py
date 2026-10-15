from trees import bst

LEVEL = '中等'
TAGS = ['二叉搜索树', '递归', '单调栈']
SAMPLES = 1


def sequences(s):
    a = list(map(int, s.split()))
    out, k = [], 1
    for _ in range(a[0]):
        n = a[k]
        out.append(a[k + 1:k + 1 + n])
        k += n + 1
    return out


def check(seq, recurse=True, right_side=True):
    stack = [(0, len(seq) - 1)]
    while stack:
        lo, hi = stack.pop()
        if lo >= hi:
            continue
        root = seq[hi]
        m = lo
        while m < hi and seq[m] < root:
            m += 1
        if right_side and any(x < root for x in seq[m:hi]):
            return False
        if recurse:
            stack += [(lo, m - 1), (m, hi - 1)]
    return True


def answer(seqs, **kw):
    return '\n'.join('true' if check(q, **kw) else 'false' for q in seqs)


def solve(s):
    return answer(sequences(s))


def wrong_top_level_only(s):
    # Checks the split at the root and never looks inside the subtrees.
    return answer(sequences(s), recurse=False)


def wrong_skips_right_check(s):
    # Recurses but never checks that the right part is larger than the root.
    return answer(sequences(s), right_side=False)


def postorder(root):
    out, stack = [], [root]
    while stack:
        node = stack.pop()
        if node:
            out.append(node.val)
            stack += [node.left, node.right]
    return out[::-1]


def fmt(seqs):
    return f'{len(seqs)}\n' + ''.join(f'{len(q)}\n{" ".join(map(str, q))}\n' for q in seqs)


def cases(r):
    out = [fmt([[1, 3, 2, 6, 5], [1, 6, 3, 2, 5]]), fmt([[7], [2, 1], [1, 2], [3, 1, 2], [1, 2, 3], [3, 2, 1]]),
           fmt([[4, 8, 6, 12, 16, 14, 10], [7, 4, 6, 5], [1, 3, 2, 5, 4, 7, 6, 9, 8]])]
    for n, t in [(6, 10), (30, 10), (300, 8), (2000, 6)]:
        seqs = []
        for k in range(t):
            q = postorder(bst(r.sample(range(-10**9, 10**9), n)))
            if k % 3 == 1:
                i, j = sorted(r.sample(range(n), 2))
                q[i], q[j] = q[j], q[i]
            elif k % 3 == 2:
                q = r.sample(q, n)
            seqs.append(q)
        out.append(fmt(seqs))
    return out
