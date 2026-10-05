def solve(raw):
    MOD=1000000007
    v=list(map(int,raw.split())); n=v[0]; a=v[1:1+n]
    dp=[1]*(a[0]+1)
    for i in range(1,n):
        need=max(1,a[i]-a[i-1]); pref=[0]*len(dp); running=0
        for j,x in enumerate(dp): running=(running+x)%MOD; pref[j]=running
        nxt=[0]*(a[i]+1)
        for b in range(a[i]+1):
            prev=b-need
            if prev>=0: nxt[b]=pref[min(prev,len(dp)-1)]
        dp=nxt
    return str(sum(dp)%MOD)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
