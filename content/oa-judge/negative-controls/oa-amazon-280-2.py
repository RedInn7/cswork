def solve(d):
    from collections import Counter
    have=Counter(d[0]);need=Counter(d[1]);return str(max(have[c]//amount for c,amount in need.items()))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
