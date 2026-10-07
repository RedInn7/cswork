import sys

def solve(raw):
    values = list(map(int, raw.split()))
    n, m, k = values[:3]
    points = [(values[i], values[i + 1]) for i in range(3, 3 + 2 * k, 2)]
    radius = values[3 + 2 * k] * values[4 + 2 * k]
    radius2 = radius * radius
    safe = 0
    for x in range(n + 1):
        for y in range(m + 1):
            if all((x - fx) ** 2 + (y - fy) ** 2 > radius2 for fx, fy in points):
                safe += 1
    return str(safe)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
