import sys

def solve(raw):
    data = list(map(int, raw.split()))
    if len(data) < 2:
        raise ValueError("expected N, K and N values")
    size, needed = data[:2]
    values = data[2:]
    if not 1 <= size <= 200_000 or len(values) != size:
        raise ValueError("N is outside the supported range or value count differs")
    if not 1 <= needed <= 200_000 or any(not -1_000_000_000 <= x <= 1_000_000_000 for x in values):
        raise ValueError("K or a value is outside the supported range")

    frequency = {}
    disjoint_pairs = 0
    left = 0
    answer = 0
    for right, value in enumerate(values):
        count = frequency.get(value, 0) + 1
        frequency[value] = count
        if count % 2 == 0:
            disjoint_pairs += 1
        while disjoint_pairs >= needed:
            answer += size - right
            left_value = values[left]
            left += 1
            frequency[left_value] -= 1
            if frequency[left_value] % 2 == 1:
                disjoint_pairs -= 1
    return str(answer)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
