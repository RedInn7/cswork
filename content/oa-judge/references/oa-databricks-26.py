def count_pairs(values):
    seen = {}
    answer = 0
    for value in values:
        digits = list(str(value))
        reachable = {value}
        for i in range(len(digits)):
            for j in range(i + 1, len(digits)):
                digits[i], digits[j] = digits[j], digits[i]
                reachable.add(int("".join(digits)))
                digits[i], digits[j] = digits[j], digits[i]
        answer += sum(seen.get(candidate, 0) for candidate in reachable)
        seen[value] = seen.get(value, 0) + 1
    return answer

def solve(raw):
    data = list(map(int, raw.split()))
    if not data or len(data) != data[0] + 1:
        raise ValueError("expected n followed by n integers")
    return str(count_pairs(data[1:]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
