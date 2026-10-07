from array import array

def solve(raw):
    data = array("q", map(int, raw.split()))
    if not data:
        return ""
    n, k = data[0], data[1]
    if not (1 <= n <= 200_000 and 1 <= k <= n):
        raise ValueError("input outside the site-defined bounds")
    if len(data) != n + 2:
        raise ValueError("expected exactly n product values")
    products = data[2:]
    if any(value < -1_000_000_000 or value > 1_000_000_000 for value in products):
        raise ValueError("product value outside the site-defined bounds")

    # The deque contains the strict suffix maxima of the active window.
    # Equal values discard the earlier index because the comparison is strict.
    queue = []
    head = 0
    total = 0
    for right, value in enumerate(products):
        left = right - k + 1
        while head < len(queue) and queue[head] < left:
            head += 1
        while len(queue) > head and products[queue[-1]] <= value:
            queue.pop()
        queue.append(right)
        if right >= k - 1:
            total += len(queue) - head
    return str(total)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
