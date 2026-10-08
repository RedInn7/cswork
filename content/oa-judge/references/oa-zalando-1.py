import sys
from functools import lru_cache

def solve(raw):
    a, b, c = map(int, raw.split())
    @lru_cache(None)
    def best(a, b, c, suffix):
        answer = ''
        counts = (a, b, c)
        for i, block in enumerate(('AA', 'AB', 'BB')):
            if not counts[i]:
                continue
            boundary = suffix + block
            if 'AAA' in boundary or 'BBB' in boundary:
                continue
            remaining = list(counts)
            remaining[i] -= 1
            candidate = block + best(*remaining, block)
            if len(candidate) > len(answer) or (len(candidate) == len(answer) and candidate < answer):
                answer = candidate
        return answer
    return best(a, b, c, '')

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
