from collections import deque
import sys

def solve(text):
    lines = text.splitlines()
    b, p = map(int, lines[0].split())
    grid = [line.split() for line in lines[1:1 + b]]
    start = end = None
    for r in range(b):
        for c in range(p):
            if grid[r][c] == "Q": start = (r, c)
            if grid[r][c] == "W": end = (r, c)
    q = deque([(start[0], start[1], -1, 0)])
    seen = {(start[0], start[1], -1, 0)}
    dirs = ((-1, 0), (1, 0), (0, -1), (0, 1))
    while q:
        r, c, old, turns = q.popleft()
        for d, (dr, dc) in enumerate(dirs):
            nt = turns + (old != -1 and old != d)
            nr, nc = r + dr, c + dc
            state = (nr, nc, d, nt)
            if nt <= 2 and 0 <= nr < b and 0 <= nc < p and grid[nr][nc] != "x" and state not in seen:
                if (nr, nc) == end: return "DRIVE!"
                seen.add(state); q.append(state)
    return "DON'T DRIVE!"

if __name__ == "__main__": print(solve(sys.stdin.read()))
