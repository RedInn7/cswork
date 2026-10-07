def construct(n, k):
    result = [0] * n
    low, high = 1, n
    for residue in range(k):
        for index in range(residue, n, k):
            if residue % 2 == 0:
                result[index] = low
                low += 1
            else:
                result[index] = high
                high -= 1
    return result

def solve(raw):
    n, k = map(int, raw.split())
    if not (2 <= k <= n <= 200_000 and k % 2 == 0):
        raise ValueError("require 2 <= K <= N <= 200000 and even K")
    return " ".join(map(str, construct(n, k)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
