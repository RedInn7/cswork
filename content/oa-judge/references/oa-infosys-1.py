import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n = data[0]
    a = data[1:]
    position = [0] * (n + 1)
    bit = [0] + a
    for i in range(1, n + 1):
        position[a[i - 1]] = i
        parent = i + (i & -i)
        if parent <= n:
            bit[parent] += bit[i]
    def prefix(i):
        value = 0
        while i:
            value += bit[i]
            i -= i & -i
        return value
    total = n * (n + 1) // 2
    head = 1
    answer = 0
    for target in range(1, n + 1):
        p = position[target]
        left = prefix(p - 1) - prefix(head - 1)
        if p < head:
            left += total
        right = total - left
        answer += min(left, right)
        i = p
        while i <= n:
            bit[i] -= target
            i += i & -i
        total -= target
        head = p + 1
        if head > n:
            head = 1
    return str(answer % 1000000007)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
