import sys

def solve(raw):
    tokens = raw.split()
    if not tokens:
        raise ValueError("missing query count")
    n = int(tokens[0])
    if len(tokens) != n + 1:
        raise ValueError("query count does not match input")
    starts = {}
    ends = {}
    best = 0
    answers = []
    for token in tokens[1:]:
        q = int(token)
        left = q
        right = q
        if q - 1 in ends:
            left = ends.pop(q - 1)
            starts.pop(left)
        if q + 1 in starts:
            right = starts.pop(q + 1)
            ends.pop(right)
        starts[left] = right
        ends[right] = left
        best = max(best, right - left + 1)
        answers.append(str(best))
    return "\n".join(answers)

if __name__ == "__main__":
    result = solve(sys.stdin.buffer.read())
    if result:
        print(result)
