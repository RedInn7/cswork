from collections import deque


def shortest_path(grid: list) -> int:
    """网格 BFS / Fewest 4-directional steps from S to T, or -1."""
    rows, cols = len(grid), len(grid[0])
    start = next((r, c) for r in range(rows) for c in range(cols) if grid[r][c] == "S")
    dist = [[-1] * cols for _ in range(rows)]
    dist[start[0]][start[1]] = 0
    queue = deque([start])
    while queue:
        r, c = queue.popleft()
        if grid[r][c] == "T":
            return dist[r][c]
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] != "#" and dist[nr][nc] < 0:
                dist[nr][nc] = dist[r][c] + 1
                queue.append((nr, nc))
    return -1


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    rows = int(data[0])
    print(shortest_path(data[2:2 + rows]))


main()
