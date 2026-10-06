import heapq
import sys

def solve(raw):
    tokens = list(map(int, raw.split()))
    if len(tokens) < 3:
        raise ValueError("expected n, m, and quantities")
    n, m = tokens[:2]
    quantity = tokens[2:]
    if not (1 <= n <= 100000 and 1 <= m <= 100000 and len(quantity) == n):
        raise ValueError("outside stated source bounds")
    if any(not 1 <= q <= 100000 for q in quantity):
        raise ValueError("outside stated source bounds")
    if m > sum(quantity):
        raise ValueError("valid input must contain at least m items")
    heap = quantity.copy()
    heapq.heapify(heap)
    revenue = 0
    for _ in range(m):
        q = --heapq.heappop(heap)
        revenue += q
        if q > 1:
            heapq.heappush(heap, q - 1)
    return str(revenue)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
