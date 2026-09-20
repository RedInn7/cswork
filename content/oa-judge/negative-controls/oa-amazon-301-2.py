def solve(d):
    n,m=map(int,d[:2]);jobs=map(int,d[2:2+n]);short=[0]+list(map(int,d[2+n:2+n+m]));long=[0]+list(map(int,d[2+n+m:]));inf=10**30;dp=[inf]*(m+1);dp[0]=0;first=(0,0);second=(inf,-1);offset=0;p=0
    for t in jobs:
        without=first[0] if first[1]!=t else second[0]
        switch=offset+min(dp[t]+short[t],without+long[t])
        offset+=short[t] if p==t else long[t]
        value=switch-offset
        if value<dp[p]:
            dp[p]=value;entry=(value,p)
            if first[1]==p:first=entry
            elif second[1]==p:
                second=entry
                if second<first:first,second=second,first
            elif entry<first:second=first;first=entry
            elif entry<second:second=entry
        p=t
    return str(offset)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
