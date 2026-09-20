def solve(d):
    from bisect import bisect_right
    n,k=map(int,d[:2]);rows=sorted(tuple(map(int,d[i:i+3])) for i in range(2,len(d),3));starts=[r[0] for r in rows];prefix=[0]
    for l,r,v in rows:prefix.append(prefix[-1]+(r-l+1)*v)
    def integral(x):
        i=bisect_right(starts,x)-1
        if i<0:return 0
        l,r,v=rows[i];return prefix[i]+(min(x,r)-l+1)*v
    answer=0
    for l,r,v in rows:
        for start in (l,max(1,r-k+1)):
            answer=max(answer,(integral(start+k-1)-integral(start-1))%1000000007)
    return str(answer%1000000007)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
