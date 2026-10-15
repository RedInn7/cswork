from collections import deque

LEVEL = '中等'
TAGS = ['广度优先搜索', '字符串']
SAMPLES = 2
MAX_N = 5000
LETTERS = 'abcdefghijklmnopqrstuvwxyz'


def parse(s):
    v = s.split()
    return v[0], v[1], v[3:3 + int(v[2])]


def neighbours(w, words):
    out = []
    for i in range(len(w)):
        for c in LETTERS:
            if c != w[i]:
                x = w[:i] + c + w[i + 1:]
                if x in words:
                    out.append(x)
    return sorted(out)


def show(path):
    return f'{len(path)} {" ".join(path)}' if path else 'none'


def solve(s):
    begin, end, ws = parse(s)
    words = set(ws)
    if end not in words:
        return 'none'
    dist, queue = {end: 0}, deque([end])
    while queue:
        w = queue.popleft()
        for x in neighbours(w, words | {begin}):
            if x not in dist:
                dist[x] = dist[w] + 1
                queue.append(x)
    if begin not in dist:
        return 'none'
    path = [begin]
    while path[-1] != end:
        path.append(next(x for x in neighbours(path[-1], words) if dist.get(x) == dist[path[-1]] - 1))
    return show(path)


def wrong_bfs_parents(s):
    # BFS from begin keeping the first parent found: shortest, but not the smallest path.
    begin, end, ws = parse(s)
    words = set(ws)
    parent, queue = {begin: None}, deque([begin])
    while queue:
        w = queue.popleft()
        if w == end:
            path = []
            while w:
                path.append(w)
                w = parent[w]
            return show(path[::-1])
        for x in reversed(neighbours(w, words)):
            if x not in parent:
                parent[x] = w
                queue.append(x)
    return 'none'


def wrong_dfs(s):
    # Depth-first, smallest neighbour first: finds a path, not the shortest.
    begin, end, ws = parse(s)
    words = set(ws)
    seen, stack = {begin}, [[begin]]
    while stack:
        path = stack.pop()
        if path[-1] == end:
            return show(path)
        for x in reversed(neighbours(path[-1], words)):
            if x not in seen:
                seen.add(x)
                stack.append(path + [x])
    return 'none'


def fmt(begin, end, ws):
    return f'{begin} {end}\n{len(ws)}\n{" ".join(ws)}\n'


def size(s):
    return int(s.split()[2])


def cases(r):
    out = [fmt('lead', 'gold', ['lean', 'load', 'loan', 'goad', 'gold', 'goal', 'toad', 'lend']),
           fmt('lead', 'gold', ['lean', 'load', 'goad', 'goal']), fmt('a', 'c', ['a', 'b', 'c']), fmt('ab', 'cd', ['ad', 'cb', 'cd']),
           fmt('abc', 'abd', ['abd']), fmt('xy', 'zz', ['xz', 'yy'])]
    for n, length, letters in [(30, 3, 'abc'), (300, 4, 'abcd'), (3000, 5, 'abcde'), (5000, 4, 'abcdef')]:
        words = sorted({''.join(r.choice(letters) for _ in range(length)) for _ in range(n)})
        begin = ''.join(r.choice(letters) for _ in range(length))
        end = r.choice(words)
        if end == begin:
            end = words[0] if words[0] != begin else words[1]
        out.append(fmt(begin, end, r.sample(words, len(words))))
    # n = 5000 words.
    words = set()
    while len(words) < 5000:
        words.add(''.join(r.choice('abcdef') for _ in range(5)))
    words = sorted(words)
    begin = words[0]
    while begin in words:
        begin = ''.join(r.choice('abcdef') for _ in range(5))
    out.append(fmt(begin, r.choice(words), r.sample(words, len(words))))
    return out
