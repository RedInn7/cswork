def solve(d):
    from collections import Counter
    return str(sum(f-1 for f in Counter(d[0]).values()))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
