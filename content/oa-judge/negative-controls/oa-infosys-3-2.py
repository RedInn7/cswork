import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, m = data[:2]
    a = [0] + data[2:2 + n]
    active = [0] * (n + 1)
    smallest = 10 ** 30
    count = 0
    for i in range(1, n + 1):
        if a[i] < smallest:
            smallest = a[i]
            active[i] = 1
            count += 1
    bit = active.copy()
    for i in range(1, n + 1):
        parent = i + (i & -i)
        if parent <= n:
            bit[parent] += bit[i]
    def add(i, delta):
        while i <= n:
            bit[i] += delta
            i += i & -i
    def prefix(i):
        result = 0
        while i:
            result += bit[i]
            i -= i & -i
        return result
    highest = 1 << (n.bit_length() - 1)
    def kth(k):
        index = 0
        step = highest
        while step:
            nxt = index + step
            if nxt <= n and bit[nxt] < k:
                k -= bit[nxt]
                index = nxt
            step >>= 1
        return index + 1
    answer = []
    offset = 2 + n
    for q in range(m):
        pos, delta = data[offset + 2 * q:offset + 2 * q + 2]
        a[pos] = a[kth(prefix(pos))] - delta
        rank = prefix(pos)
        if not active[pos]:
            previous = kth(rank)
            if a[pos] >= a[previous]:
                answer.append(str(count))
                continue
            add(pos, 1)
            active[pos] = 1
            count += 1
            rank += 1
        while rank < count:
            following = kth(rank + 1)
            if a[following] < a[pos]:
                break
            add(following, -1)
            active[following] = 0
            count -= 1
        answer.append(str(count))
    return ' '.join(answer)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
