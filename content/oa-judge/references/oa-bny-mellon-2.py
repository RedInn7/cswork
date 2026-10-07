import sys

MOD = 1_000_000_007

def solve(raw):
    data = list(map(int, raw.split()))
    n, left, right = data[:3]
    values = data[3:]
    counts = [0] * (n + 1)
    for value in values:
        if value <= n:
            counts[value] += 1
    powers = [1] * (n + 1)
    for i in range(1, n + 1):
        powers[i] = powers[i - 1] * 2 % MOD

    answer = prefix = 0
    product = 1
    remaining = n
    for mex in range(min(n, right) + 1):
        count = counts[mex]
        remaining -= count
        if mex >= left:
            answer = (answer + product * powers[remaining]) % MOD
        product = product * (powers[count] - 1) % MOD
    return str(answer)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
