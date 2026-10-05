def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; a=v[1:1+n]
    if n<3: return str(max(a))
    # dp maps the remaining first value to the least cost so far.
    x,y,z=a[:3]; dp={}
    for keep, paid in ((x,max(y,z)),(y,max(x,z)),(z,max(x,y))):
        dp[keep]=min(dp.get(keep,10**30),paid)
    i=3
    while i+1<n:
        p,q=a[i],a[i+1]; nxt={}
        for carry,cost in dp.items():
            for keep,paid in ((carry,max(p,q)),(p,max(carry,q)),(q,max(carry,p))):
                nxt[keep]=min(nxt.get(keep,10**30),cost+paid)
        dp=nxt; i+=2
    if i<n:
        return str(min(cost+max(carry,a[i]) for carry,cost in dp.items()))
    return str(min(cost for carry,cost in dp.items()))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
