import sys

def solve(raw):
    lines = raw.splitlines()
    if len(lines) != 3:
        raise ValueError("expected password, reference, and 26 costs")
    password, reference = lines[0], lines[1]
    costs = list(map(int, lines[2].split()))
    if not 1 <= len(password) <= 100_000 or not 1 <= len(reference) <= 100_000:
        raise ValueError("string length must be in [1, 100000]")
    if len(costs) != 26 or any(not 1 <= cost <= 100 for cost in costs):
        raise ValueError("expected 26 costs in [1, 100]")
    if any(not ('a' <= char <= 'z') for char in password + reference):
        raise ValueError("strings must contain lowercase English letters")
    removable = set(reference)
    return str(sum(costs[ord(char) - ord('a')] for char in password if char in removable))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
