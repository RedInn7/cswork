def solve(d):
    from itertools import islice
    n,m,k=map(int,d[:3]);dp=[0]+[10**9]*k
    for row in islice(d,3,None):
        pos=[i for i,c in enumerate(row) if c=='1'];count=len(pos);cost=[]
        for skip in range(min(k,count)+1):
            keep=count-skip;cost.append(1 if keep==0 else min(pos[i+keep-1]-pos[i]+1 for i in range(skip+1)))
        new=[10**9]*(k+1)
        for used in range(k+1):
            for skip,value in enumerate(cost[:k-used+1]):new[used+skip]=min(new[used+skip],dp[used]+value)
        dp=new
    return str(min(dp))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
