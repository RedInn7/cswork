def solve(raw):
    data = list(map(int, raw.split()))
    n = data[0]
    size = 4 * n
    values = data[1:]
    if len(values) != size * size:
        raise ValueError("expected an (4n) x (4n) matrix")
    matrix = [values[r * size:(r + 1) * size] for r in range(size)]

    missing_values = []
    for br in range(n):
        for bc in range(n):
            total = 0
            for dr in range(4):
                for dc in range(4):
                    value = matrix[4 * br + dr][4 * bc + dc]
                    if value != -1:
                        total += value
            missing_values.append(136 - total)

    # The destination positions are ordered by the entire matrix, not by blocks.
    positions = [(r, c) for r in range(size) for c in range(size)
                 if matrix[r][c] == -1]
    for (r, c), value in zip(positions, sorted(missing_values)):
        matrix[r][c] = value
    return "\n".join(" ".join(map(str, row)) for row in matrix)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
