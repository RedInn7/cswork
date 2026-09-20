def solve(raw):
    from bisect import bisect_left
    data=list(map(int,raw.split()));n=data[0];lender=data[1:n+1];payback=data[n+1:]
    values=sorted(set(payback));rank={v:i+1 for i,v in enumerate(values)}
    debts=[rank[v] for v in payback];limits=[bisect_left(values,v) for v in lender]
    unreachable=len(values)+1;best=bytearray([unreachable])*(1<<n);best[0]=0;answer=0
    for mask in range(1,1<<n):
        bits=mask;debt=unreachable
        while bits:
            bit=bits&-bits;j=bit.bit_length()-1;bits-=bit
            if best[mask^bit]<=limits[j] and debts[j]<debt:debt=debts[j]
        best[mask]=debt
        if debt!=unreachable:answer=max(answer,mask.bit_count())
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
