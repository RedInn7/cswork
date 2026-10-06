import heapq
import sys

def solve(text):
    data = text.split()
    n, removals = map(int, data[:2])
    counts = [0] * 26
    for ch in data[2].strip(): counts[ord(ch) - 97] += 1
    heap = [-x for x in counts if x]
    heapq.heapify(heap)
    for _ in range(min(removals, n)):
        largest = -heapq.heappop(heap)
        if largest > 1: heapq.heappush(heap, -(largest - 1))
    return str(sum(x * x for x in heap))

if __name__ == "__main__": print(solve(sys.stdin.read()))
