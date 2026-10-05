import sys
v=list(map(int,sys.stdin.buffer.read().split()));n=v[0];rs=v[1:n+2];cs=v[n+2:2*n+3];dp=[None]*(n+1);dp[0]=0
for right in range(1,n+1):
    best=None
    low=max(0,right-200);base_by_left={};prefix_best=None
    for x in range(right-1,low-1,-1):
        if dp[x] is not None:prefix_best=dp[x] if prefix_best is None else min(prefix_best,dp[x])
        base_by_left[x]=prefix_best
    for i in range(max(0,right-100),min(n,right+100)+1):
        r,cost=rs[i],cs[i];left=max(0,i-r);far=min(n,i+r)
        if far<right or left>=right:continue
        base=base_by_left[left]
        if base is not None:best=base+cost if best is None else min(best,base+cost)
    dp[right]=best
print(-1 if dp[n] is None else dp[n])
