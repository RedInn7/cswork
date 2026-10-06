import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, m = data[0], data[1]
    pods = data[2:2 + n]
    logs = [data[i:i + 3] for i in range(2 + n, 2 + n + 3 * m, 3)]

    # suffix[i] = largest type-2 target at operation i or later.
    suffix = [0] * (m + 1)
    for i in range(m - 1, -1, -1):
        typ, _, x = logs[i]
        suffix[i] = max(suffix[i + 1], x if typ == 2 else 0)

    last_value = pods[:]
    last_assignment = [0] * n  # initial values are assigned at time 0
    for time, (typ, p, x) in enumerate(logs, start=1):
        if typ == 1:
            last_value[p - 1] = x
            last_assignment[p - 1] = time

    answer = [max(last_value[i], suffix[last_assignment[i]]) for i in range(n)]
    return " ".join(map(str, answer))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
