import sys
from collections import Counter

def solve(raw):
    data = list(map(int, raw.split()))
    n, cards = data[0], data[1:]
    largest = max(cards)
    frequencies = Counter(cards)
    best = n * (largest + 1)
    # No packet count above largest+1 can improve: each added amount
    # is k-cardType there and the total strictly increases with k.
    for packets in range(2, largest + 2):
        added = sum(frequency * ((-count) % packets)
                    for count, frequency in frequencies.items())
        best = min(best, added)
    return str(best)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
