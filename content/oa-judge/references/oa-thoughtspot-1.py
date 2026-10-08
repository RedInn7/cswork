import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, m = data[:2]
    counts = [0] * n
    for service in data[2:]:
        counts[service - 1] += 1
    low, high = 0, max(counts)
    while low < high:
        mid = (low + high) // 2
        excess = 0
        capacity = 0
        for count in counts:
            if count > mid:
                excess += count - mid
            else:
                capacity += (mid - count) // 2
        if capacity >= excess:
            high = mid
        else:
            low = mid + 1
    return str(low)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
