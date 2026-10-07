import sys


def solve(raw):
    values = list(map(int, raw.split()))
    if not values:
        return ""
    n = values[0]
    if n < 1 or n > 200_000 or len(values) != 1 + 2 * n:
        raise ValueError("expected N, then N arrivals and N departures")
    starts = values[1:1 + n]
    ends = values[1 + n:]
    events = []
    for start, end in zip(starts, ends):
        if not (-1_000_000_000 <= start < end <= 1_000_000_000):
            raise ValueError("each interval must satisfy -1e9 <= S < E <= 1e9")
        events.append((start, 1))
        events.append((end, -1))
    # In half-open [S, E) intervals, departures release chairs before
    # arrivals at the same instant. Sorting delta ascending implements that.
    events.sort(key=lambda event: (event[0], -event[1]))
    occupied = answer = 0
    for _, delta in events:
        occupied += delta
        answer = max(answer, occupied)
    return str(answer)


if __name__ == "__main__":
    print(solve(sys.stdin.read()))
