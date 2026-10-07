import sys
from collections import deque

def solve(raw):
    data = list(map(int, raw.split()))
    n, x = data[:2]
    queue = deque((index + 1, value) for index, value in enumerate(data[2:2+n]))
    selected = []
    for _ in range(x):
        batch = [queue.popleft() for _ in range(min(x, len(queue)))]
        chosen = max(range(len(batch)), key=lambda i: batch[i][1])
        selected.append(batch[chosen][0])
        for index, value in batch[:chosen] + batch[chosen + 1:]:
            queue.append((index, max(0, value - 1)))
    return " ".join(map(str, selected))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
