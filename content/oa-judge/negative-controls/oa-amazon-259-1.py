def solve(d):
    from bisect import bisect_right
    n=int(d[0]);a=list(map(int,d[1:1+n]));b=list(map(int,d[1+n:1+2*n]));c=list(map(int,d[1+2*n:]));items=sorted((x+y,x,z) for x,y,z in zip(a,b,c));ends=[e for e,s,w in items];dp=[0]
    for i,(end,start,value) in enumerate(items):
        j=bisect_right(ends,start,0,i);dp.append(max(dp[-1],dp[j]+value))
    return str(dp[-1])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
