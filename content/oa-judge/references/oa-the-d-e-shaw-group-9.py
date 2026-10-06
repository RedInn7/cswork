import heapq
import sys

def min_acquire_cost(stations, capacity):
    occupied = set(stations)
    frontier = []
    for station in stations:
        heapq.heappush(frontier, (1, station - 1))
        heapq.heappush(frontier, (1, station + 1))
    total = 0
    bought = 0
    while bought < capacity:
        distance, position = heapq.heappop(frontier)
        if position in occupied:
            continue
        occupied.add(position)
        total += distance
        bought += 1
        heapq.heappush(frontier, (distance + 1, position - 1))
        heapq.heappush(frontier, (distance + 1, position + 1))
    return total

def solve(raw):
    values = list(map(int, raw.split()))
    if len(values) < 2:
        raise ValueError("expected n and capacity")
    n, capacity = values[:2]
    if len(values) != n + 2:
        raise ValueError("station count does not match header")
    return str(min_acquire_cost(values[2:], capacity))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.buffer.read()))
