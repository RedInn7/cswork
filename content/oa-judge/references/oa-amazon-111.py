def solve(d):
    from bisect import bisect_left
    n=int(d[0]);s=list(map(int,d[1:1+n]));duration=list(map(int,d[1+n:1+2*n]));v=list(map(int,d[1+2*n:]));jobs=sorted((a+b,a,c) for a,b,c in zip(s,duration,v));ends=[j[0] for j in jobs];dp=[0]
    for end,start,value in jobs:
        compatible=bisect_left(ends,start);dp.append(max(dp[-1],dp[compatible]+value))
    return str(dp[-1])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
