import sys
from collections import Counter

def solve(raw):
    data = list(map(int, raw.split()))
    if not data:
        raise ValueError("expected N and N integer values")
    n, values = data[0], data[1:]
    if not 1 <= n <= 100_000 or len(values) != n:
        raise ValueError("N is outside the supported range or value count differs")
    if any(not -1_000_000_000 <= value <= 1_000_000_000 for value in values):
        raise ValueError("an input value is outside [-10^9, 10^9]")
    mean = sum(values) // n  # Python // implements mathematical floor for negatives.
    counts = Counter(values)
    maximum_frequency = max(counts.values())
    mode = min(value for value, frequency in counts.items() if frequency == maximum_frequency)
    return f"{mean} {mode}"

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
