from math import comb

from trees import bst, dump, parse

LEVEL = '困难'
TAGS = ['二叉搜索树', '回溯']
SAMPLES = 2
MAX_N = 12


def weave(a, b):
    if not a or not b:
        return [a + b]
    return [[a[0]] + w for w in weave(a[1:], b)] + [[b[0]] + w for w in weave(a, b[1:])]


def orders(node, interleave=True):
    if node is None:
        return [[]]
    out = []
    for x in orders(node.left, interleave):
        for y in orders(node.right, interleave):
            if interleave:
                out += [[node.val] + w for w in weave(x, y)]
            else:
                out += [[node.val] + x + y, [node.val] + y + x] if x and y else [[node.val] + x + y]
    return out


def show(seqs):
    return '\n'.join(' '.join(map(str, q)) for q in seqs)


def solve(s):
    return show(sorted(orders(parse(s))))


def wrong_no_interleaving(s):
    # Puts one whole subtree before the other instead of interleaving them.
    return show(sorted(map(list, {tuple(q) for q in orders(parse(s), interleave=False)})))


def wrong_text_order(s):
    return '\n'.join(sorted(' '.join(map(str, q)) for q in orders(parse(s))))


def count(node):
    if node is None:
        return 1, 0
    a, na = count(node.left)
    b, nb = count(node.right)
    return a * b * comb(na + nb, na), na + nb + 1


def size(s):
    return sum(v != 'null' for v in s.split())


def cases(r):
    out = ['6 4 9\n', '5 3 8 null 4 7 9\n', '7\n', '1 null 2 null 3\n', '10 9 null 8\n', '4 2 6 1 3 5 7\n',
           '9 5 20 3 null 12 30\n']
    while len(out) < 14:
        n = r.randint(5, 12)
        root = bst(r.sample(range(1, 101), n))
        if 30 <= count(root)[0] <= 5000:
            out.append(dump(root) + '\n')
    return out
