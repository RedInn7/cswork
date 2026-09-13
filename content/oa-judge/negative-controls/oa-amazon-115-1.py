def solve(d):
    from collections import Counter
    counts=Counter(d[0]);left=''.join(c*(counts[c]//2) for c in sorted(counts));middle=''.join(c for c in sorted(counts) if counts[c]%2)
    return ''.join(sorted(d[0]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
