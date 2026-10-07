import sys

def solve(raw):
    values = list(map(int, raw.split()))
    if len(values) != 1 or not 0 <= values[0] <= 2_000_000_000:
        raise ValueError("expected one N in [0, 2000000000]")
    n = values[0]
    best = n
    for bits in range(1, 32):
        half = (bits + 1) // 2
        low = 1 << (half - 1)
        high = (1 << half) - 1
        prefix = n >> (bits // 2)
        for first in {low, high, max(low, min(high, prefix)), max(low, min(high, prefix - 1)), max(low, min(high, prefix + 1))}:
            text = format(first, "b")
            mirrored = text + (text[:-1] if bits % 2 else text)[::-1]
            candidate = int(mirrored, 2)
            best = min(best, abs(candidate - n))
    return str(best)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
