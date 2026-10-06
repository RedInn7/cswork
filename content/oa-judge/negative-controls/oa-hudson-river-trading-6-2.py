def decode(raw):
    data = list(map(int, raw.split()))
    rows = data[0]
    grid = []
    pos = 1
    for _ in range(rows):
        cols = data[pos]
        pos += 1
        grid.append(data[pos:pos + cols])
        pos += cols
    if pos != len(data):
        raise ValueError("unexpected trailing input")
    return grid

def solve(raw):
    grid = decode(raw)
    cells = {(r, c): value for r, row in enumerate(grid) for c, value in enumerate(row)}
    ways = {}
    answer = 0
    for (r, c), value in sorted(cells.items(), key=lambda item: item[1], reverse=True):
        count = 0
        for nr, nc in ((r + 1, c), (r, c + 1)):
            if (nr, nc) in cells and cells[(nr, nc)] > value:
                count += 1 + ways[(nr, nc)]
        ways[(r, c)] = count
        answer += count
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
