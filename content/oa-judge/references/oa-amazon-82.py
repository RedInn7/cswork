import sys

def solve(raw):
    values = map(int, raw.split())
    n, m = next(values), next(values)
    # Source stock bounds allow a compact, standard-library-only frequency table.
    freq = [0] * 1_000_001
    high, low = 0, 1_000_001
    for _ in range(n):
        stock = next(values)
        freq[stock] += 1
        if stock > high:
            high = stock
        if stock < low:
            low = stock
    revenue = 0
    for _ in range(m):
        while high and freq[high] == 0:
            high -= 1
        if high == 0:
            break
        revenue += high + low
        freq[high] -= 1
        if high > 1:
            freq[high - 1] += 1
            if high - 1 < low:
                low = high - 1
    return str(revenue)

if __name__ == '__main__':
    print(solve(sys.stdin.buffer.read()))
