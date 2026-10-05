def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; s=v[1:1+n]; t=v[1+n:1+2*n]
    y=[(t[i]-s[i]) if i%2==0 else (t[i]-s[i]) for i in range(n)]
    z=[0]*(n+1); prev=0
    for i,x in enumerate(y): z[i]=x-prev; prev=x
    z[n]=-prev
    answer=0
    for parity in (0,1):
        prefix=0
        for i in range(parity,n+1,2):
            prefix+=z[i]
            if (parity==0 and prefix<0) or (parity==1 and prefix>0): return '-1'
            answer+=max(0,z[i])
        if prefix: return '-1'
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
