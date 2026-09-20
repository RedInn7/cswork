def solve(d):
    from bisect import bisect_right
    n,q=map(int,d[:2]);a=sorted(map(int,d[2:2+n]));pre=[0]
    for v in a:pre.append(pre[-1]+v)
    out=[]
    for t in map(int,d[2+n:]):
        c=bisect_right(a,t);out.append(c*t-pre[c]+pre[n]-pre[c]-(n-c)*t)
    return ' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
