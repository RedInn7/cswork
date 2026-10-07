import sys

def calculate_minimum_value(s, x, y):
    inf = 10**100
    cost = [inf, inf]
    if s[0] in "0!": cost[0] = 0
    if s[0] in "1!": cost[1] = 0
    for char in s[1:]:
        next_cost = [inf, inf]
        for bit in (0, 1):
            if char != "!" and int(char) != bit:
                continue
            for previous in (0, 1):
                add = x if (previous, bit) == (0, 1) else y if (previous, bit) == (1, 0) else 0
                next_cost[bit] = min(next_cost[bit], cost[previous] + add)
        cost = next_cost
    return min(cost)

def solve(raw):
    parts = raw.split()
    if len(parts) != 3:
        raise ValueError("expected S, x, and y")
    s, x_text, y_text = parts
    x, y = int(x_text), int(y_text)
    if not s or any(char not in "01!" for char in s) or "!" not in s:
        raise ValueError("S must contain 0, 1, and at least one !")
    if not (0 <= x <= 2**31 - 1 and 0 <= y <= 2**31 - 1):
        raise ValueError("x and y must be nonnegative 32-bit integers")
    return str(calculate_minimum_value(s, x, y))

if __name__ == "__main__":
    print(solve(sys.stdin.buffer.read().decode("ascii")))
