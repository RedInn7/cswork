import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, factor = data[:2]
    ratings = data[2:]
    if not (1 <= n <= 200000 and 1 <= factor <= 10000 and len(ratings) == n):
        raise ValueError("invalid input shape or factor")
    if any(abs(x) > 1000000000 for x in ratings):
        raise ValueError("rating outside site range")
    answer = None
    for divide in (False, True):
        before = inside = after = None
        for x in ratings:
            changed = (abs(x) // factor) * (1 if x >= 0 else -1) if divide else x * factor
            new_before = x if before is None else max(x, before + x)
            new_inside = changed
            if before is not None:
                new_inside = max(new_inside, before + changed)
            if inside is not None:
                new_inside = max(new_inside, inside + changed)
            new_after = None if inside is None else inside + x
            if after is not None:
                new_after = after + x if new_after is None else max(new_after, after + x)
            before, inside, after = new_before, new_inside, new_after
            candidate = inside if after is None else max(inside, after)
            answer = candidate if answer is None else max(answer, candidate)
    return str(answer)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
