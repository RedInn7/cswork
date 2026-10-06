def solve(raw):
    tokens = list(map(int, raw.split()))
    if not tokens:
        return "0"
    n, target = tokens[0], tokens[1]
    values = tokens[2:2+n]
    mid = n // 2
    left_values, right_values = values[:mid], values[mid:]
    left_sums = [0]
    for x in left_values:
        size = len(left_sums)
        left_sums.extend(left_sums[i] + x for i in range(size))
    reachable = set(left_sums)
    total = 0
    previous_gray = 0
    for mask in range(1 << len(right_values)):
        gray = mask ^ (mask >> 1)
        if mask:
            changed = gray ^ previous_gray
            bit = changed.bit_length() - 1
            total += right_values[bit] if gray & changed else -right_values[bit]
        if target - total in reachable:
            return "1"
        previous_gray = gray
    return "0"

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.buffer.read()))
