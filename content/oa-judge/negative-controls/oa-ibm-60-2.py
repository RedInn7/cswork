def solve(d):
    from bisect import bisect_left
    n,q=map(int,d[:2]);a=sorted(map(int,d[2:n+2]));prefix=[0]
    for v in a:prefix.append(prefix[-1]+v)
    out=[]
    for t in map(int,d[n+2:]):
        p=bisect_left(a,t);out.append(abs(t*n-prefix[n]))
    return '\n'.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
