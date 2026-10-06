def count_ways(fragments, access_code):
    target = str(access_code)
    answer = 0
    counts = {}
    for fragment in fragments:
        text = str(fragment)
        counts[text] = counts.get(text, 0) + 1
    for cut in range(1, len(target)):
        left, right = target[:cut], target[cut:]
        left_count = counts.get(left, 0)
        right_count = counts.get(right, 0)
        answer += left_count * right_count
        if left == right:
            answer -= left_count
    return answer

def solve(raw):
    data = list(map(int, raw.split()))
    if len(data) < 2 or len(data) != data[0] + 2:
        raise ValueError("expected n, accessCode, then n fragments")
    n, access_code = data[:2]
    return str(count_ways(data[2:], access_code))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
