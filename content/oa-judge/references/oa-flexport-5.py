def solve(raw):
    values = list(map(int, raw.split()))
    n, m = values[:2]
    players = sorted(values[2:2+n])
    points = sorted(values[2+n:2+n+m])

    def feasible(time):
        first = 0
        for player in players:
            if first == m:
                return True
            point = points[first]
            if point < player - time:
                return False
            if point > player + time:
                continue
            if point <= player:
                leftmost = point
                while first < m and points[first] <= player:
                    first += 1
                left_distance = player - leftmost
                reach = max(
                    player + time - 2 * left_distance,
                    player + (time - left_distance) // 2,
                )
            else:
                reach = player + time
            while first < m and points[first] <= reach:
                first += 1
        return first == m

    low, high = 0, 2_000_000_001
    while low < high:
        middle = (low + high) // 2
        if feasible(middle):
            high = middle
        else:
            low = middle + 1
    return str(low)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
