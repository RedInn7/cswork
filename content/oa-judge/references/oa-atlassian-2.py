def solve(raw):
    p,q,s=raw.split();p=int(p);q=int(q);dp=[0,0,0]
    for end in range(1,len(s)+1):
        value=dp[-1]
        if end>=2 and s[end-2:end] in ('01','10'):value=max(value,dp[-2]+q)
        if end>=3 and s[end-3:end]=='000':value=max(value,dp[-3]+p)
        dp=[dp[-2],dp[-1],value]
    return str(dp[-1])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
