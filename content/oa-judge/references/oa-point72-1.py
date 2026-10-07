import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, divisor = data[0], data[1]
    values = data[2:]
    counts = [0] * divisor
    for value in values:
        counts[value % divisor] += 1
    answer = 0
    for a in range(divisor):
        for b in range(a, divisor):
            c = (-(a + b)) % divisor
            if c < b:
                continue
            if a == b == c:
                answer += counts[a] * (counts[a] - 1) * (counts[a] - 2) // 6
            elif a == b:
                answer += counts[a] * (counts[a] - 1) // 2 * counts[c]
            elif b == c:
                answer += counts[a] * counts[b] * (counts[b] - 1) // 2
            else:
                answer += counts[a] * counts[b] * counts[c]
    return str(answer)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
