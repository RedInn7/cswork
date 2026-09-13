def solve(d):
    from collections import Counter
    a=list(map(int,d[1:])); n=len(a); largest=max(Counter(a).values())
    return str(max(2*largest-n,n%2))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
