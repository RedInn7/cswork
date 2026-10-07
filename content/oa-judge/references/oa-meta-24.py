import sys


def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        return ""
    n = data[0]
    if not 2 <= n <= 200_000 or len(data) != 1 + 2 * n:
        raise ValueError("expected n >= 2 followed by two arrays of length n")
    departing = data[1:1 + n]
    returning = data[1 + n:]
    if any(not -1_000_000_000 <= x <= 1_000_000_000 for x in departing + returning):
        raise ValueError("fare is outside the site-supported range")

    best_return = returning[-1]
    answer = departing[-2] + best_return
    for i in range(n - 2, -1, -1):
        best_return = min(best_return, returning[i + 1])
        answer = min(answer, departing[i] + best_return)
    return str(answer)


if __name__ == "__main__":
    print(solve(sys.stdin.read()))
