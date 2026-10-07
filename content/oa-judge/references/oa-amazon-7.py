import sys

def solve(raw):
    tokens = iter(map(int, raw.split()))
    n = next(tokens)
    players = [sorted((next(tokens), next(tokens), next(tokens))) for _ in range(n)]
    # The two largest entries retain their identities, including equal values.
    def extrema(column):
        best = second = -1
        owner = -1
        for i, row in enumerate(players):
            value = row[column]
            if value > best:
                second, best, owner = best, value, i
            elif value > second:
                second = value
        return best, second, owner
    a, a2, ai = extrema(0)
    b, b2, bi = extrema(1)
    answer = 0
    for i, row in enumerate(players):
        opponent_min = a2 if i == ai else a
        opponent_middle = b2 if i == bi else b
        answer += row[1] > opponent_min and row[2] > opponent_middle
    return str(answer)

if __name__ == '__main__':
    print(solve(sys.stdin.buffer.read()))
