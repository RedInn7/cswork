def solve(d):
    from collections import Counter
    counts=Counter(d[1:])
    if 1 in counts.values() or 4 in counts.values():return '-1'
    return str(sum((c+2)//3 for c in counts.values()))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
