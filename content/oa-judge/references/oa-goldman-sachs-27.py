import heapq
import sys

def solve(raw):
    tokens = raw.split()
    if not tokens:
        raise ValueError("missing operation count")
    n = int(tokens[0])
    if len(tokens) != 1 + 2 * n:
        raise ValueError("operation count does not match input")
    minimum_heap = []
    maximum_heap = []
    frequency = {}
    products = []
    pos = 1
    for _ in range(n):
        operation = tokens[pos].decode("ascii")
        value = int(tokens[pos + 1])
        pos += 2
        if operation == "push":
            frequency[value] = frequency.get(value, 0) + 1
            heapq.heappush(minimum_heap, value)
            heapq.heappush(maximum_heap, -value)
        else:
            count = frequency[value]
            if count == 1:
                del frequency[value]
            else:
                frequency[value] = count - 1
        while minimum_heap and frequency.get(minimum_heap[0], 0) == 0:
            heapq.heappop(minimum_heap)
        while maximum_heap and frequency.get(-maximum_heap[0], 0) == 0:
            heapq.heappop(maximum_heap)
        if frequency:
            products.append(minimum_heap[0] * -maximum_heap[0])
        else:
            products.append(0)
    return "\n".join(map(str, products))

if __name__ == "__main__":
    import sys
    result = solve(sys.stdin.buffer.read())
    if result:
        print(result)
