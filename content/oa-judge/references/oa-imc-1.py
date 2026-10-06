import bisect
import sys

def min_waste_set(requirements, container_sets):
    best_index = -1
    best_waste = None
    for index, containers in enumerate(container_sets, 1):
        ordered = sorted(containers)
        total = 0
        feasible = True
        for required in requirements:
            pos = bisect.bisect_left(ordered, required)
            if pos == len(ordered):
                feasible = False
                break
            total += ordered[pos] - required
        if feasible and (best_waste is None or total < best_waste):
            best_index = index
            best_waste = total
    return best_index

def solve(raw):
    values = list(map(int, raw.split()))
    if len(values) < 2:
        raise ValueError("missing requirement/set counts")
    r, s = values[0], values[1]
    if len(values) < 2 + r:
        raise ValueError("missing requirements")
    requirements = values[2:2 + r]
    pos = 2 + r
    container_sets = []
    for _ in range(s):
        if pos >= len(values):
            raise ValueError("missing container count")
        count = values[pos]
        pos += 1
        if pos + count > len(values):
            raise ValueError("missing container sizes")
        container_sets.append(values[pos:pos + count])
        pos += count
    if pos != len(values):
        raise ValueError("unexpected trailing input")
    return str(min_waste_set(requirements, container_sets))

if __name__ == "__main__":
    print(solve(sys.stdin.buffer.read()))
