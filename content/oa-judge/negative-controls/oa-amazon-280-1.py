def solve(d):
    from collections import Counter
    have=Counter(d[0]);need=Counter(d[1]);return str(min(have[c] for c,amount in need.items()))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
