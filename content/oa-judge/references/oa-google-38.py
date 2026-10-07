import sys

def suffix_ranks(text):
    size = len(text)
    order = list(range(size))
    rank = [ord(ch) for ch in text]
    width = 1
    while width < size:
        order.sort(key=lambda i: (rank[i], rank[i + width] if i + width < size else -1))
        next_rank = [0] * size
        classes = 0
        previous = None
        for index in order:
            key = (rank[index], rank[index + width] if index + width < size else -1)
            if previous is not None and key != previous:
                classes += 1
            next_rank[index] = classes
            previous = key
        rank = next_rank
        if classes == size - 1:
            break
        width *= 2
    return rank

def solve(raw):
    parts = raw.split()
    if len(parts) != 2:
        raise ValueError("expected strings A and B")
    a, b = parts
    if not (1 <= len(a) <= 20000 and 1 <= len(b) <= 50000):
        raise ValueError("input exceeds the supported string lengths")
    if any(ch < 'a' or ch > 'z' for ch in a + b):
        raise ValueError("only lowercase English letters are supported")
    length = len(a)
    if len(b) < length:
        return "-1"

    difference = [0] * 26
    for ch in a:
        difference[ord(ch) - 97] += 1
    for ch in b[:length]:
        difference[ord(ch) - 97] -= 1
    mismatches = sum(value != 0 for value in difference)
    valid = [False] * (len(b) - length + 1)
    for start in range(len(valid)):
        valid[start] = mismatches == 0
        if start + length < len(b):
            for ch, delta in ((b[start], 1), (b[start + length], -1)):
                index = ord(ch) - 97
                mismatches -= difference[index] != 0
                difference[index] += delta
                mismatches += difference[index] != 0
    if not any(valid):
        return "-1"

    rank = suffix_ranks(b)
    best = max((start for start, is_valid in enumerate(valid) if is_valid), key=rank.__getitem__)
    return b[best:best + length]

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
