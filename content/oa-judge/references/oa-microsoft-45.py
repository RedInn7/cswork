import sys

def minimum_deletions_to_sorted(s):
    tails = []
    for char in s:
        lo, hi = 0, len(tails)
        # upper_bound: equal letters may remain together in a nondecreasing subsequence.
        while lo < hi:
            mid = (lo + hi) // 2
            if tails[mid] <= char:
                lo = mid + 1
            else:
                hi = mid
        if lo == len(tails):
            tails.append(char)
        else:
            tails[lo] = char
    return len(s) - len(tails)

def solve(raw):
    s = raw.strip()
    if not s or any(not ('a' <= char <= 'z') for char in s):
        raise ValueError("expected one nonempty lowercase English word")
    return str(minimum_deletions_to_sorted(s))

if __name__ == "__main__":
    print(solve(sys.stdin.buffer.read().decode("ascii")))
