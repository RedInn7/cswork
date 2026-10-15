from collections import Counter

LEVEL = '中等'
TAGS = ['哈希表', '设计']
SAMPLES = 1


def parse(s):
    lines = s.split('\n')
    return lines[1].split(), lines[3].split()


def solve(s):
    book, qs = parse(s)
    count = Counter(book)
    return '\n'.join(str(count[w]) for w in qs)


def wrong_substrings(s):
    book, qs = parse(s)
    text = ' '.join(book)
    return '\n'.join(str(text.count(w)) for w in qs)


def wrong_prefixes(s):
    # Counts every word that starts with the query.
    book, qs = parse(s)
    count = Counter()
    for w in book:
        for k in range(1, len(w) + 1):
            count[w[:k]] += 1
    return '\n'.join(str(count[w]) for w in qs)


def fmt(book, qs):
    return f'{len(book)}\n{" ".join(book)}\n{len(qs)}\n{" ".join(qs)}\n'


def cases(r):
    out = [fmt('the sun and the moon and the stars shine on the sea'.split(), ['the', 'and', 'sun', 'star', 'on', 'moonlight']),
           fmt(['a'], ['a', 'b']), fmt(['aa', 'a', 'aaa'], ['a', 'aa', 'aaa', 'aaaa'])]
    for n, q, letters, longest in [(20, 10, 'ab', 3), (1000, 500, 'abc', 4), (20000, 10000, 'abcdefgh', 5)]:
        vocab = [''.join(r.choice(letters) for _ in range(r.randint(1, longest))) for _ in range(max(5, n // 20))]
        book = [r.choice(vocab) for _ in range(n)]
        qs = [r.choice(vocab) if r.random() < 0.7 else ''.join(r.choice(letters) for _ in range(r.randint(1, longest)))
              for _ in range(q)]
        out.append(fmt(book, qs))
    return out
