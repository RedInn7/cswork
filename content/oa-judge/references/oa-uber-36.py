import sys


def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        return ""
    n, m = data[0], data[1]
    if not (1 <= n <= 50_000 and 1 <= m <= 50_000):
        raise ValueError("array lengths must be within the site bounds")
    if len(data) != 2 + n + m:
        raise ValueError("expected n, m, then both arrays")
    arr1 = data[2:2 + n]
    arr2 = data[2 + n:]
    if any(not 1 <= value <= 1_000_000_000 for value in arr1 + arr2):
        raise ValueError("array values must be positive and within the site bounds")

    prefixes = set()
    for value in arr1:
        digits = str(value)
        for end in range(1, len(digits) + 1):
            prefixes.add(digits[:end])
    answer = 0
    for value in arr2:
        digits = str(value)
        for end in range(1, len(digits) + 1):
            if digits[:end] not in prefixes:
                break
            answer = max(answer, end)
    return str(answer)


if __name__ == "__main__":
    print(solve(sys.stdin.read()))
