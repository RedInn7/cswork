def solve(d):
    from collections import Counter
    s=d[0];count=Counter(s)
    return str(next((i+1 for i,c in enumerate(s) if count[c]==1),-1))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
