LEVEL = '中等'
TAGS = ['并查集', '哈希表']
SAMPLES = 1


def parse(s):
    v = s.split()
    n = int(v[0])
    names = {v[1 + 2 * i]: int(v[2 + 2 * i]) for i in range(n)}
    k = 1 + 2 * n
    m = int(v[k])
    return names, [(v[k + 1 + 2 * i], v[k + 2 + 2 * i]) for i in range(m)]


def merge(names, pairs, transitive=True, smallest=True):
    parent = {x: x for x in names}

    def find(x):
        if not transitive:
            return parent[x]
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for a, b in pairs:
        ra, rb = find(a), find(b)
        if ra != rb:
            if smallest and rb < ra:
                ra, rb = rb, ra
            parent[rb] = ra
    total = {}
    for x, c in names.items():
        root = find(x)
        total[root] = total.get(root, 0) + c
    return '\n'.join(f'{x} {c}' for x, c in sorted(total.items()))


def solve(s):
    return merge(*parse(s))


def wrong_direct_pairs_only(s):
    return merge(*parse(s), transitive=False)


def wrong_first_name_wins(s):
    # Keeps the first name of each pair as the root instead of the smallest.
    return merge(*parse(s), smallest=False)


def fmt(names, pairs):
    return (f'{len(names)}\n' + ''.join(f'{x} {c}\n' for x, c in names) + f'{len(pairs)}\n'
            + ''.join(f'{a} {b}\n' for a, b in pairs))


def cases(r):
    out = [fmt([('Ana', 7), ('Anna', 5), ('Hanna', 3), ('Bo', 9), ('Beau', 2), ('Lin', 6)],
               [('Anna', 'Hanna'), ('Ana', 'Anna'), ('Beau', 'Bo')]),
           fmt([('Ann', 1)], []), fmt([('b', 1), ('a', 2), ('c', 3)], [('c', 'b'), ('b', 'a')]),
           fmt([('Zed', 5), ('Amy', 0)], [('Zed', 'Amy'), ('Amy', 'Zed')])]
    for n, m in [(10, 6), (300, 250), (5000, 4000)]:
        names = set()
        while len(names) < n:
            names.add(''.join(r.choice('AEIKMOSTaeikmost') for _ in range(r.randint(1, 6))))
        names = sorted(names)
        out.append(fmt([(x, r.randint(0, 10000)) for x in names], [tuple(r.sample(names, 2)) for _ in range(m)]))
    return out
