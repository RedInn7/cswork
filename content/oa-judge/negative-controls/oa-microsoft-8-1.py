def solve(d):
    rows,cols,k=map(int,d[:3]);a=list(map(int,d[3:]));houses=[(i//cols+i%cols,i//cols-i%cols) for i,v in enumerate(a) if v]
    if not houses:return str(rows*cols)
    minp=min(p for p,q in houses);maxp=max(p for p,q in houses);minq=min(q for p,q in houses);maxq=max(q for p,q in houses);answer=0
    for index,v in enumerate(a):
        i,j=divmod(index,cols);p=i+j;q=i-j
        if True and max(p-minp,maxp-p,q-minq,maxq-q)<=k:answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
