import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, arr = data[0], data[1:]
    prefix = [0]
    for value in arr:
        prefix.append(prefix[-1] + value)
    rise = [[0] * (n + 1) for _ in range(n)]
    fall = [[0] * (n + 1) for _ in range(n)]
    for i in range(1, n):
        for j in range(i + 1, n + 1):
            new_sum = prefix[j] - prefix[i]
            new_size = j - i
            up = down = 0
            for h in range(i):
                previous_cross = (prefix[i] - prefix[h]) * new_size
                new_cross = new_sum * (i - h)
                if previous_cross < new_cross:
                    up += rise[h][i] + (h == 0)
                elif previous_cross > new_cross:
                    down += rise[h][i] + fall[h][i]
            rise[i][j], fall[i][j] = up, down
    answer = sum(fall[i][n] for i in range(n))
    return str(answer)

if __name__ == '__main__':
    print(solve(sys.stdin.buffer.read()))
