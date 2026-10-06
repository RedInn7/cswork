def solve(raw):
    values = list(map(int, raw.split()))
    if len(values) < 3:
        raise ValueError("expected n m journeys and two schedules")
    n, m, journeys = values[:3]
    if len(values) != 3 + n + m:
        raise ValueError("schedule length does not match header")
    c2d = values[3:3+n]
    d2c = values[3+n:]
    time = 0
    outbound = return_flight = 0
    for _ in range(journeys):
        while outbound < n and c2d[outbound] < time:
            outbound += 1
        if outbound == n:
            return "-1"
        time = c2d[outbound] + 100
        outbound += 1

        while return_flight < m and d2c[return_flight] < time:
            return_flight += 1
        if return_flight == m:
            return "-1"
        time = d2c[return_flight] + 100
        return_flight += 1
    return str(time)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.buffer.read()))
